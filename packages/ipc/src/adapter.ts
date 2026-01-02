// IPC server adapter stub (Phase-1)
// Factory to create a minimal IPC server; actual transport to be implemented later

import type { ActaMessage } from './types'
import { isValidActaMessage } from './validator'

export interface IpcAdapter {
  start(): Promise<void>
  stop(): Promise<void>
  send(message: ActaMessage): void
  onMessage(callback: (msg: ActaMessage) => void): void
}

export interface IpcAdapterOptions {
  transport: 'http' | 'unix-socket' // Phase-1: http only
  port?: number // for http transport
  path?: string // for unix-socket
}

export function createIpcAdapter(options: IpcAdapterOptions): IpcAdapter {
  if (options.transport === 'http') {
    return new HttpIpcAdapter(options.port ?? 5001)
  }
  // unix-socket stub for future
  throw new Error('Unix socket transport not yet implemented')
}

// Minimal HTTP-based IPC adapter (Phase-1 stub)
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
