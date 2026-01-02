import { randomUUID } from 'node:crypto'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { loadConfig } from '@acta/core'
import { createLogger } from '@acta/logging'
import {
  isValidActaMessage,
  validatePayload,
  type ActaMessage,
  type ActaMessageType,
  type TaskErrorPayload,
  type TaskRequest,
} from '@acta/ipc'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { PermissionCoordinator } from './ipc-ws/permission-coordinator'
import { runTaskRequest } from './ipc-ws/task-execution'
import { createRuntimeWsTransport, type RuntimeWsTransport } from './ipc-ws/ws-transport'

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

  private permissionCoordinator: PermissionCoordinator

  /**
   * Create a new instance of the IPC WebSocket server.
   *
   * @param options - The configuration options for the server.
   */
  constructor() {
    this.permissionCoordinator = new PermissionCoordinator({
      getLogLevel: () => this.options?.logLevel ?? 'info',
      broadcast: msg => this.broadcast(msg),
      emitMessage: (type, payload, opts) => this.emitMessage(type, payload, opts),
    })
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
      case 'permission.response':
        this.permissionCoordinator.handlePermissionResponse(msg)
        return
      default:
        logger.warn('IPC received unsupported message type', { type: msg.type })
        return
    }
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
    const profileId = msg.profileId ?? cfg.profileId ?? 'default'
    const correlationId = msg.correlationId ?? msg.id

    const logger = createLogger('task-request', cfg.logLevel)

    const attachments = msg.payload?.context?.files ?? []
    const attachmentLine = attachments.length ? `\n\nAttachments (paths only):\n- ${attachments.join('\n- ')}` : ''
    const input = `${msg.payload.input}${attachmentLine}`

    try {
      const emitEvent = this.permissionCoordinator.createAgentEventAdapter({ correlationId, profileId })

      await runTaskRequest({
        input,
        profileId,
        correlationId,
        logLevel: cfg.logLevel,
        emitEvent,
        waitForPermission: this.permissionCoordinator.waitForPermission({ correlationId }),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('task.request failed', { correlationId, profileId, message })

      const payload: TaskErrorPayload = {
        code: 'task.failed',
        message,
      }
      this.emitMessage('task.error', payload, { correlationId, profileId, source: 'system', replyTo: msg.id })
    }
  }

  private sendIpcError(ws: WebSocket, payload: TaskErrorPayload, context?: ActaMessage): void {
    const logger = createLogger('ipc-ws', this.options?.logLevel ?? 'info')
    logger.warn('IPC rejecting message', payload)

    const reply: ActaMessage<TaskErrorPayload> = {
      id: randomUUID(),
      type: 'task.error',
      source: 'system',
      timestamp: Date.now(),
      payload,
      correlationId: context?.correlationId,
      replyTo: context?.id,
      profileId: context?.profileId,
    }

    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(reply))
  }
}
