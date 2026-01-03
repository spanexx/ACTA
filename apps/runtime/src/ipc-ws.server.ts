import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ProfileService } from './profile.service'
import type { ActaMessage } from '@acta/ipc'

import { RuntimeWsIpcServerCore } from './ipc-ws/server/runtime-ws-ipc-core'

/**
 * Code Map: RuntimeWsIpcServer (NestJS Injectable wrapper)
 * - CID:runtime-ws-ipc-001 → Configuration interface
 * - CID:runtime-ws-ipc-002 → Main server class (NestJS wrapper)
 * - CID:runtime-ws-ipc-003 → Constructor/delegation setup
 * - CID:runtime-ws-ipc-004 → Configuration delegation
 * - CID:runtime-ws-ipc-005 → URL getter delegation
 * - CID:runtime-ws-ipc-006 → Lifecycle hooks (NestJS)
 * - CID:runtime-ws-ipc-007 → Start/stop delegation
 * - CID:runtime-ws-ipc-008 → Broadcast delegation
 * 
 * Quick lookup: grep -n "CID:runtime-ws-ipc-" apps/runtime/src/ipc-ws.server.ts
 */

// CID:runtime-ws-ipc-001 - Configuration interface
// Purpose: Defines WebSocket server configuration options
// Uses: TypeScript primitive types
// Used by: RuntimeWsIpcServer class constructor and configure method
export interface RuntimeWsIpcServerOptions {
  host: string // The host to listen on
  port: number // The port to listen on
  path: string // The path for WebSocket connections
  logLevel: 'debug' | 'info' | 'warn' | 'error' // The log level to use
}

/**
 * A WebSocket server for the runtime IPC.
 */

// CID:runtime-ws-ipc-002 - Main server class (NestJS wrapper)
// Purpose: NestJS Injectable wrapper around RuntimeWsIpcServerCore
// Uses: Injectable decorator, OnModuleInit/OnModuleDestroy interfaces, ProfileService
// Used by: NestJS app.module.ts as provider
@Injectable()
export class RuntimeWsIpcServer implements OnModuleInit, OnModuleDestroy {
  private core: RuntimeWsIpcServerCore

  // CID:runtime-ws-ipc-003 - Constructor/delegation setup
  // Purpose: Initialize core server instance with profile service dependency
  // Uses: ProfileService dependency injection, RuntimeWsIpcServerCore
  // Used by: NestJS dependency injection system
  constructor(private readonly profileService: ProfileService) {
    this.core = new RuntimeWsIpcServerCore(this.profileService)
  }

  // CID:runtime-ws-ipc-004 - Configuration delegation
  // Purpose: Pass configuration options to core server
  // Uses: RuntimeWsIpcServerOptions interface, core.configure method
  // Used by: Application bootstrap/configuration
  configure(options: RuntimeWsIpcServerOptions): void {
    this.core.configure(options)
  }

  // CID:runtime-ws-ipc-005 - URL getter delegation
  // Purpose: Get server URL from core instance
  // Uses: core.getUrl method
  // Used by: External clients needing to connect to the server
  getUrl(): string | null {
    return this.core.getUrl()
  }

  // CID:runtime-ws-ipc-006 - Lifecycle hooks (NestJS)
  // Purpose: Delegate NestJS lifecycle events to core server
  // Uses: OnModuleInit/OnModuleDestroy interfaces, core lifecycle methods
  // Used by: NestJS framework during application startup/shutdown
  async onModuleInit(): Promise<void> {
    await this.core.onModuleInit()
  }

  async onModuleDestroy(): Promise<void> {
    await this.core.onModuleDestroy()
  }

  /**
   * Start the IPC WebSocket server.
   *
   * @returns A promise that resolves when the server is started.
   */
  // CID:runtime-ws-ipc-007 - Start/stop delegation
  // Purpose: Delegate server start/stop operations to core
  // Uses: core.start and core.stop methods
  // Used by: Application lifecycle management and manual server control
  async start(): Promise<void> {
    await this.core.start()
  }

  // CID:runtime-ws-ipc-008 - Broadcast delegation
  // Purpose: Delegate message broadcasting to core server
  // Uses: ActaMessage type, core.broadcast method
  // Used by: Core server message routing and event emission
  broadcast(msg: ActaMessage): void {
    this.core.broadcast(msg)
  }

  /**
   * Stop the IPC WebSocket server.
   *
   * @returns A promise that resolves when the server is stopped.
   */
  async stop(): Promise<void> {
    await this.core.stop()
  }
}
