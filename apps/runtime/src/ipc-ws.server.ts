import { randomUUID } from 'node:crypto'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { loadConfig } from '@acta/core'
import { createLogger } from '@acta/logging'
import {
  isValidActaMessage,
  validatePayload,
  type ActaMessage,
  type ActaMessageType,
  type ProfileActivePayload,
  type ProfileCreateRequest,
  type ProfileCreatePayload,
  type ProfileDoc,
  type ProfileDeletePayload,
  type ProfileDeleteRequest,
  type ProfileGetPayload,
  type ProfileGetRequest,
  type ProfileListPayload,
  type ProfileSummary,
  type ProfileSwitchPayload,
  type ProfileSwitchRequest,
  type ProfileUpdatePayload,
  type ProfileUpdateRequest,
  type TaskErrorPayload,
  type TaskRequest,
  type TaskStopRequest,
  type RuntimeTask,
} from '@acta/ipc'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { PermissionCoordinator } from './ipc-ws/permission-coordinator'
import { runTaskRequest } from './ipc-ws/task-execution'
import { createRuntimeWsTransport, type RuntimeWsTransport } from './ipc-ws/ws-transport'
import { AgentService, AgentServiceBusyError } from './agent.service'
import { ProfileService } from './profile.service'

// Configuration options for the IPC WebSocket server
export interface RuntimeWsIpcServerOptions {
  host: string // The host to listen on
  port: number // The port to listen on
  path: string // The path for WebSocket connections
  logLevel: 'debug' | 'info' | 'warn' | 'error' // The log level to use
}

/**
 * A WebSocket server for the runtime IPC.
 */
@Injectable()
export class RuntimeWsIpcServer implements OnModuleInit, OnModuleDestroy {
  private transport?: RuntimeWsTransport
  private options?: RuntimeWsIpcServerOptions

  private agentService: AgentService

  private permissionCoordinator: PermissionCoordinator

  /**
   * Create a new instance of the IPC WebSocket server.
   *
   * @param options - The configuration options for the server.
   */
  constructor(private readonly profileService: ProfileService) {
    this.permissionCoordinator = new PermissionCoordinator({
      getLogLevel: () => this.options?.logLevel ?? 'info',
      broadcast: msg => this.broadcast(msg),
      emitMessage: (type, payload, opts) => this.emitMessage(type, payload, opts),
      getLogsDir: profileId => this.profileService.getLogsDir(profileId),
      getTrustDir: profileId => this.profileService.getTrustDir(profileId),
    })

    this.agentService = new AgentService(runTaskRequest)
  }

  private toDoc(profile: any): ProfileDoc {
    return {
      id: profile.id,
      name: profile.name,
      setupComplete: Boolean(profile.setupComplete),
      trust: {
        defaultTrustLevel: Number(profile.trust?.defaultTrustLevel ?? 2),
        tools: profile.trust?.tools,
        domains: profile.trust?.domains,
      },
      llm: {
        mode: profile.llm?.mode === 'cloud' ? 'cloud' : 'local',
        adapterId: String(profile.llm?.adapterId ?? 'ollama'),
        model: String(profile.llm?.model ?? 'llama3:8b'),
        endpoint: typeof profile.llm?.endpoint === 'string' ? profile.llm.endpoint : undefined,
        cloudWarnBeforeSending:
          typeof profile.llm?.cloudWarnBeforeSending === 'boolean' ? profile.llm.cloudWarnBeforeSending : undefined,
      },
    }
  }

  configure(options: RuntimeWsIpcServerOptions): void {
    this.options = options
  }

  getUrl(): string | null {
    if (!this.transport || !this.options) return null
    const addr = this.transport.server.address() as AddressInfo | string | null
    if (!addr || typeof addr === 'string') return null
    return `ws://${this.options.host}:${addr.port}${this.options.path}`
  }

  async onModuleInit(): Promise<void> {
    if (!this.options) {
      const cfg = loadConfig()
      this.options = {
        host: cfg.ipcHost,
        port: cfg.ipcPort,
        path: cfg.ipcPath,
        logLevel: cfg.logLevel,
      }
    }
    await this.start()
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop()
  }

  /**
   * Start the IPC WebSocket server.
   *
   * @returns A promise that resolves when the server is started.
   */
  async start(): Promise<void> {
    if (!this.options) throw new Error('IPC server options not configured')
    if (this.transport) return

    await this.profileService.init()

    const options = this.options

    const logger = createLogger('ipc-ws', options.logLevel)

    const transport = createRuntimeWsTransport({
      host: options.host,
      port: options.port,
      path: options.path,
      logLevel: options.logLevel,
      onParseError: (ws, error, context) => {
        this.sendIpcError(ws, error, context)
      },
      onHandlerError: (ws, error, context) => {
        this.sendIpcError(ws, error, context)
      },
      onActaMessage: (ws, msg) => {
        void this.routeMessage(msg).catch(err => {
          logger.error('IPC handler error', err)
          this.sendIpcError(
            ws,
            {
              taskId: typeof msg?.id === 'string' ? msg.id : 'unknown',
              code: 'ipc.handler_error',
              message: err instanceof Error ? err.message : String(err),
            },
            msg,
          )
        })
      },
    })

    await transport.listen()
    this.transport = transport
  }

  broadcast(msg: ActaMessage): void {
    if (!this.transport) return
    if (!isValidActaMessage(msg) || !validatePayload(msg.type, msg.payload)) {
      const logger = createLogger('ipc-ws', this.options?.logLevel ?? 'info')
      logger.warn('IPC refusing to broadcast invalid message', { type: (msg as any)?.type })
      return
    }
    const serialized = JSON.stringify(msg)
    for (const client of this.transport.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(serialized)
    }
  }

  /**
   * Stop the IPC WebSocket server.
   *
   * @returns A promise that resolves when the server is stopped.
   */
  async stop(): Promise<void> {
    if (!this.options) return

    if (!this.transport) return
    await this.transport.close()
    this.transport = undefined
  }

  private async routeMessage(msg: ActaMessage): Promise<void> {
    const logger = createLogger('ipc-ws', this.options?.logLevel ?? 'info')
    switch (msg.type) {
      case 'task.request':
        await this.handleTaskRequest(msg as ActaMessage<TaskRequest>)
        return
      case 'task.stop':
        await this.handleTaskStop(msg as ActaMessage<TaskStopRequest>)
        return
      case 'permission.response':
        this.permissionCoordinator.handlePermissionResponse(msg)
        return
      case 'profile.list':
        await this.handleProfileList(msg)
        return
      case 'profile.create':
        await this.handleProfileCreate(msg as ActaMessage<ProfileCreateRequest>)
        return
      case 'profile.delete':
        await this.handleProfileDelete(msg as ActaMessage<ProfileDeleteRequest>)
        return
      case 'profile.switch':
        await this.handleProfileSwitch(msg as ActaMessage<ProfileSwitchRequest>)
        return
      case 'profile.active':
        await this.handleProfileActive(msg)
        return
      case 'profile.get':
        await this.handleProfileGet(msg as ActaMessage<ProfileGetRequest>)
        return
      case 'profile.update':
        await this.handleProfileUpdate(msg as ActaMessage<ProfileUpdateRequest>)
        return
      default:
        logger.warn('IPC received unsupported message type', { type: msg.type })
        return
    }
  }

  private toSummary(profile: { id: string; name: string }, activeId: string | null): ProfileSummary {
    return {
      id: profile.id,
      name: profile.name,
      active: profile.id === activeId,
    }
  }

  private async handleProfileList(msg: ActaMessage): Promise<void> {
    const activeId = this.profileService.getActiveProfileId()
    const profiles = await this.profileService.list()
    const payload: ProfileListPayload = {
      profiles: profiles.map(p => this.toSummary(p, activeId)),
    }
    this.emitMessage('profile.list', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }

  private async handleProfileActive(msg: ActaMessage): Promise<void> {
    const activeId = this.profileService.getActiveProfileId()
    const active = await this.profileService.getActiveProfile()
    const payload: ProfileActivePayload = {
      profile: active ? this.toSummary(active, activeId) : null,
    }
    this.emitMessage('profile.active', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }

  private async handleProfileCreate(msg: ActaMessage<ProfileCreateRequest>): Promise<void> {
    if (!msg.payload || typeof msg.payload.name !== 'string' || !msg.payload.name.trim()) {
      throw new Error('Invalid profile.create payload (missing name)')
    }

    const created = await this.profileService.create({
      name: msg.payload.name,
      profileId: msg.payload.profileId,
    })
    const activeId = this.profileService.getActiveProfileId()
    const payload: ProfileCreatePayload = {
      profile: this.toSummary(created, activeId),
    }

    this.emitMessage('profile.create', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }

  private async handleProfileDelete(msg: ActaMessage<ProfileDeleteRequest>): Promise<void> {
    if (!msg.payload || typeof msg.payload.profileId !== 'string') {
      throw new Error('Invalid profile.delete payload (missing profileId)')
    }

    await this.profileService.delete(msg.payload.profileId, { deleteFiles: msg.payload.deleteFiles })
    const activeId = this.profileService.getActiveProfileId()

    const payload: ProfileDeletePayload = {
      deleted: true,
      profileId: msg.payload.profileId,
    }

    this.emitMessage('profile.delete', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }

  private async handleProfileSwitch(msg: ActaMessage<ProfileSwitchRequest>): Promise<void> {
    if (!msg.payload || typeof msg.payload.profileId !== 'string') {
      throw new Error('Invalid profile.switch payload (missing profileId)')
    }
    if (this.agentService.isRunning()) {
      throw new Error('Profile switch blocked while a task is running')
    }

    const profile = await this.profileService.switch(msg.payload.profileId)
    const activeId = this.profileService.getActiveProfileId()

    const payload: ProfileSwitchPayload = {
      profile: this.toSummary(profile, activeId),
    }

    this.emitMessage('profile.switch', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }

  private async handleProfileGet(msg: ActaMessage<ProfileGetRequest>): Promise<void> {
    const profile = await this.profileService.getProfile(msg.payload?.profileId)
    const activeId = this.profileService.getActiveProfileId()

    const payload: ProfileGetPayload = {
      profile: this.toDoc(profile),
    }

    this.emitMessage('profile.get', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }

  private async handleProfileUpdate(msg: ActaMessage<ProfileUpdateRequest>): Promise<void> {
    if (!msg.payload || typeof msg.payload.profileId !== 'string' || !msg.payload.profileId.trim()) {
      throw new Error('Invalid profile.update payload (missing profileId)')
    }

    const updated = await this.profileService.update(msg.payload.profileId, msg.payload.patch as any)
    const activeId = this.profileService.getActiveProfileId()

    const payload: ProfileUpdatePayload = {
      profile: this.toDoc(updated),
    }

    this.emitMessage('profile.update', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }

  private emitMessage<T>(
    type: ActaMessageType,
    payload: T,
    opts: { correlationId?: string; profileId?: string; replyTo?: string; source?: ActaMessage['source'] },
  ): void {
    const msg: ActaMessage<T> = {
      id: randomUUID(),
      type,
      source: opts.source ?? 'agent',
      timestamp: Date.now(),
      payload,
      correlationId: opts.correlationId,
      profileId: opts.profileId,
      replyTo: opts.replyTo,
    }

    this.broadcast(msg)
  }

  private async handleTaskRequest(msg: ActaMessage<TaskRequest>): Promise<void> {
    const cfg = loadConfig()
    const profileId = msg.profileId ?? this.profileService.getActiveProfileId() ?? cfg.profileId
    const correlationId = msg.correlationId ?? msg.id

    if (!profileId) {
      const payload: TaskErrorPayload = {
        taskId: msg.id,
        code: 'task.missing_profile',
        message: 'No active profile available to execute task',
      }
      this.emitMessage('task.error', payload, { correlationId, source: 'system', replyTo: msg.id })
      return
    }

    let logsDir: string | undefined
    let memoryDir: string | undefined
    let trustDir: string | undefined
    try {
      logsDir = await this.profileService.getLogsDir(profileId)
    } catch {
      logsDir = this.profileService.getActiveLogsDir() ?? undefined
    }
    try {
      memoryDir = await this.profileService.getMemoryDir(profileId)
    } catch {
      memoryDir = this.profileService.getActiveMemoryDir() ?? undefined
    }

    try {
      trustDir = await this.profileService.getTrustDir(profileId)
    } catch {
      trustDir = undefined
    }

    const logger = createLogger('task-request', cfg.logLevel, logsDir ? { dir: logsDir } : undefined)

    const attachments = msg.payload?.context?.files ?? []
    const task: RuntimeTask = {
      taskId: msg.id,
      correlationId,
      profileId,
      input: msg.payload.input,
      attachments: attachments.length ? attachments : undefined,
    }

    try {
      const emitEvent = this.permissionCoordinator.createAgentEventAdapter({ correlationId, profileId, taskId: msg.id })

      await this.agentService.start({
        task,
        logLevel: cfg.logLevel,
        logsDir,
        memoryDir,
        trustDir,
        emitEvent,
        waitForPermission: this.permissionCoordinator.waitForPermission({ correlationId }),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('task.request failed', { correlationId, profileId, message })

      const payload: TaskErrorPayload =
        err instanceof AgentServiceBusyError
          ? {
              taskId: msg.id,
              code: 'task.busy',
              message: 'A task is already running',
            }
          : {
              taskId: msg.id,
              code: 'task.failed',
              message,
            }

      this.emitMessage('task.error', payload, { correlationId, profileId, source: 'system', replyTo: msg.id })
    }
  }

  private async handleTaskStop(msg: ActaMessage<TaskStopRequest>): Promise<void> {
    const cfg = loadConfig()
    const logger = createLogger('task-stop', cfg.logLevel)

    const correlationId = typeof msg.payload?.correlationId === 'string' ? msg.payload.correlationId : msg.correlationId

    const ok = this.agentService.requestStop({ correlationId: correlationId ?? undefined })
    logger.info('task.stop received', { correlationId, ok })

    this.emitMessage(
      'system.event',
      { event: 'task.stop', ok, correlationId },
      {
        source: 'system',
        replyTo: msg.id,
        correlationId: msg.correlationId,
        profileId: msg.profileId,
      },
    )
  }

  private sendIpcError(ws: WebSocket, payload: TaskErrorPayload, context?: ActaMessage): void {
    const logger = createLogger('ipc-ws', this.options?.logLevel ?? 'info')
    logger.warn('IPC rejecting message', payload)

    const normalized: TaskErrorPayload = {
      taskId: typeof payload?.taskId === 'string' ? payload.taskId : (typeof context?.id === 'string' ? context.id : 'unknown'),
      code: payload.code,
      message: payload.message,
      stepId: (payload as any)?.stepId,
      details: (payload as any)?.details,
    }

    const reply: ActaMessage<TaskErrorPayload> = {
      id: randomUUID(),
      type: 'task.error',
      source: 'system',
      timestamp: Date.now(),
      payload: normalized,
      correlationId: context?.correlationId,
      replyTo: context?.id,
      profileId: context?.profileId,
    }

    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(reply))
  }
}
