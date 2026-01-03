/*
 * Code Map: Runtime WebSocket IPC Server Core
 * - RuntimeWsIpcServerCore: Main server class for IPC communication
 * - configure: Set server configuration options
 * - getUrl: Get server WebSocket URL
 * - onModuleInit: Initialize server with config from environment
 * - onModuleDestroy: Clean shutdown of server
 * - start: Start WebSocket server with transport and handlers
 * - stop: Stop server and cleanup resources
 * - broadcast: Send message to all connected clients
 * - emitMessage: Create and send structured message
 * - sendIpcError: Send error message to specific client
 * 
 * CID Index:
 * CID:runtime-ws-ipc-core-001 -> RuntimeWsIpcServerCore constructor
 * CID:runtime-ws-ipc-core-002 -> configure
 * CID:runtime-ws-ipc-core-003 -> getUrl
 * CID:runtime-ws-ipc-core-004 -> onModuleInit
 * CID:runtime-ws-ipc-core-005 -> onModuleDestroy
 * CID:runtime-ws-ipc-core-006 -> start
 * CID:runtime-ws-ipc-core-007 -> broadcast
 * CID:runtime-ws-ipc-core-008 -> emitMessage
 * CID:runtime-ws-ipc-core-009 -> sendIpcError
 * 
 * Quick lookup: rg -n "CID:runtime-ws-ipc-core-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/server/runtime-ws-ipc-core.ts
 */

import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'

import { loadConfig } from '@acta/core'
import { createLogger } from '@acta/logging'
import {
  isValidActaMessage,
  validatePayload,
  type ActaMessage,
  type ActaMessageType,
  type TaskErrorPayload,
} from '@acta/ipc'

import { AgentService } from '../../agent.service'
import type { ProfileService } from '../../profile.service'
import { PermissionCoordinator } from '../permission-coordinator'
import { runTaskRequest } from '../task-execution'
import { createRuntimeWsTransport, type RuntimeWsTransport } from '../ws-transport'
import { sendIpcError } from './ipc-error'
import { createProfileHandlers, type ProfileHandlers } from './profile-handlers'
import { toDoc, toSummary } from './profile-mappers'
import { createRuntimeIpcRouter } from './router'
import { createTaskHandlers, type TaskHandlers } from './task-handlers'

export type RuntimeWsIpcServerCoreOptions = {
  host: string
  port: number
  path: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

// CID:runtime-ws-ipc-core-001 - RuntimeWsIpcServerCore constructor
// Purpose: Initialize IPC server with profile service and create all handlers/coordinators
// Uses: ProfileService, PermissionCoordinator, AgentService, handler factories
// Used by: Dependency injection system to create server instance
export class RuntimeWsIpcServerCore {
  private transport?: RuntimeWsTransport
  private options?: RuntimeWsIpcServerCoreOptions

  private agentService: AgentService

  private permissionCoordinator: PermissionCoordinator

  private profileHandlers: ProfileHandlers
  private taskHandlers: TaskHandlers
  private routeMessageImpl: (msg: ActaMessage) => Promise<void>

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

    this.profileHandlers = createProfileHandlers({
      profileService: this.profileService,
      agentService: this.agentService,
      emitMessage: (type, payload, opts) => this.emitMessage(type, payload, opts),
      toDoc,
      toSummary,
    })

    this.taskHandlers = createTaskHandlers({
      profileService: this.profileService,
      agentService: this.agentService,
      permissionCoordinator: this.permissionCoordinator,
      emitMessage: (type, payload, opts) => this.emitMessage(type, payload, opts),
    })

    this.routeMessageImpl = createRuntimeIpcRouter({
      getLogLevel: () => this.options?.logLevel ?? 'info',
      profileHandlers: this.profileHandlers,
      taskHandlers: this.taskHandlers,
      permissionCoordinator: this.permissionCoordinator,
    })
  }

  // CID:runtime-ws-ipc-core-002 - configure
  // Purpose: Set server configuration options (host, port, path, log level)
  // Uses: RuntimeWsIpcServerCoreOptions type
  // Used by: Application startup to configure server settings
  configure(options: RuntimeWsIpcServerCoreOptions): void {
    this.options = options
  }

  // CID:runtime-ws-ipc-core-003 - getUrl
  // Purpose: Construct WebSocket URL from server address and configuration
  // Uses: Transport server address, options configuration
  // Used by: Clients to connect to the IPC server
  getUrl(): string | null {
    if (!this.transport || !this.options) return null
    const addr = this.transport.server.address() as AddressInfo | string | null
    if (!addr || typeof addr === 'string') return null
    return `ws://${this.options.host}:${addr.port}${this.options.path}`
  }

  // CID:runtime-ws-ipc-core-004 - onModuleInit
  // Purpose: Lifecycle hook - auto-configure and start server with default config
  // Uses: loadConfig, start method
  // Used by: Dependency injection framework on module initialization
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

  // CID:runtime-ws-ipc-core-005 - onModuleDestroy
  // Purpose: Lifecycle hook - clean shutdown of server
  // Uses: stop method
  // Used by: Dependency injection framework on module destruction
  async onModuleDestroy(): Promise<void> {
    await this.stop()
  }

  /**
   * Start the IPC WebSocket server.
   *
   * @returns A promise that resolves when the server is started.
   */
  // CID:runtime-ws-ipc-core-006 - start
  // Purpose: Start WebSocket server with transport, error handlers, and message routing
  // Uses: ProfileService init, transport creation, error handling, message routing
  // Used by: onModuleInit lifecycle and manual server startup
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
        sendIpcError({ ws, payload: error, context, logLevel: this.options?.logLevel ?? 'info' })
      },
      onHandlerError: (ws, error, context) => {
        sendIpcError({ ws, payload: error, context, logLevel: this.options?.logLevel ?? 'info' })
      },
      onActaMessage: (ws, msg) => {
        void this.routeMessageImpl(msg).catch(err => {
          logger.error('IPC handler error', err)
          sendIpcError({
            ws,
            payload: {
              taskId: typeof msg?.id === 'string' ? msg.id : 'unknown',
              code: 'ipc.handler_error',
              message: err instanceof Error ? err.message : String(err),
            },
            context: msg,
            logLevel: this.options?.logLevel ?? 'info',
          })
        })
      },
    })

    await transport.listen()
    this.transport = transport
  }

  // CID:runtime-ws-ipc-core-007 - broadcast
  // Purpose: Send message to all connected WebSocket clients with validation
  // Uses: Message validation, WebSocket client iteration
  // Used by: emitMessage and external message broadcasting
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

  // CID:runtime-ws-ipc-core-008 - emitMessage
  // Purpose: Create structured ActaMessage and broadcast to all clients
  // Uses: randomUUID, broadcast method
  // Used by: Handlers and coordinators to send responses
  emitMessage<T>(
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

  // CID:runtime-ws-ipc-core-009 - sendIpcError
  // Purpose: Wrapper for sendIpcError with server log level
  // Uses: sendIpcError from ipc-error module
  // Used by: Transport layer error handling
  sendIpcError(ws: WebSocket, payload: TaskErrorPayload, context?: ActaMessage): void {
    sendIpcError({ ws, payload, context, logLevel: this.options?.logLevel ?? 'info' })
  }
}
