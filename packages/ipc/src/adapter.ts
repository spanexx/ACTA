/*
 * Code Map: IPC Adapter Stub
 * - IpcAdapter / IpcAdapterOptions: Interfaces describing IPC adapter contract
 * - createIpcAdapter: Factory to instantiate transport-specific adapter
 * - HttpIpcAdapter: Phase-1 HTTP stub with logging helpers
 *
 * CID Index:
 * CID:ipc-adapter-001 -> IpcAdapter interface
 * CID:ipc-adapter-002 -> IpcAdapterOptions interface
 * CID:ipc-adapter-003 -> createIpcAdapter factory
 * CID:ipc-adapter-004 -> HttpIpcAdapter class
 *
 * Quick lookup: rg -n "CID:ipc-adapter-" /home/spanexx/Shared/Projects/ACTA/packages/ipc/src/adapter.ts
 */

import type { ActaMessage } from './types'
import { isValidActaMessage } from './validator'

// CID:ipc-adapter-001 - IpcAdapter interface
// Purpose: Define lifecycle/event contract adapters must satisfy
export interface IpcAdapter {
  start(): Promise<void>
  stop(): Promise<void>
  send(message: ActaMessage): void
  onMessage(callback: (msg: ActaMessage) => void): void
}

// CID:ipc-adapter-002 - IpcAdapterOptions interface
// Purpose: Specify transport configuration for adapter factory
export interface IpcAdapterOptions {
  transport: 'http' | 'unix-socket' // Phase-1: http only
  port?: number // for http transport
  path?: string // for unix-socket
}

// CID:ipc-adapter-003 - createIpcAdapter
// Purpose: Instantiate adapter based on transport type
export function createIpcAdapter(options: IpcAdapterOptions): IpcAdapter {
  if (options.transport === 'http') {
    return new HttpIpcAdapter(options.port ?? 5001)
  }
  // unix-socket stub for future
  throw new Error('Unix socket transport not yet implemented')
}

// Minimal HTTP-based IPC adapter (Phase-1 stub)
// CID:ipc-adapter-004 - HttpIpcAdapter
// Purpose: Placeholder HTTP adapter that logs operations and validates messages
class HttpIpcAdapter implements IpcAdapter {
  private server?: any // Express-like app placeholder
  private listeners: Array<(msg: ActaMessage) => void> = []

  constructor(private port: number) {}

  async start(): Promise<void> {
    // Phase-1: no real server; just log readiness
    console.log(`[IPC Stub] HTTP adapter would start on port ${this.port}`)
  }

  async stop(): Promise<void> {
    console.log('[IPC Stub] HTTP adapter stopped')
  }

  send(message: ActaMessage): void {
    // Phase-1: no-op; later push to connected clients
    console.log('[IPC Stub] send:', message)
  }

  onMessage(callback: (msg: ActaMessage) => void): void {
    this.listeners.push(callback)
    // Phase-1: no real endpoint; later POST /message
  }

  // Internal: simulate receiving a message (for testing)
  _receiveRaw(msg: unknown): void {
    if (isValidActaMessage(msg)) {
      this.listeners.forEach(cb => cb(msg))
    } else {
      console.warn('[IPC Stub] Invalid message received:', msg)
    }
  }
}
