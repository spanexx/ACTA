import { Injectable } from '@angular/core'
import { BehaviorSubject, Subject } from 'rxjs'
import { isValidActaMessage, validatePayload, type ActaMessage, type TaskRequest } from '@acta/ipc'

export type RuntimeConnectionState = {
  status: 'disconnected' | 'connecting' | 'connected'
  error?: string
}

@Injectable({ providedIn: 'root' })
export class RuntimeIpcService {
  private ws: WebSocket | null = null
  private shouldRun = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0

  private connectionSubject = new BehaviorSubject<RuntimeConnectionState>({ status: 'disconnected' })
  readonly connection$ = this.connectionSubject.asObservable()

  private messagesSubject = new Subject<ActaMessage>()
  readonly messages$ = this.messagesSubject.asObservable()

  readonly url = 'ws://127.0.0.1:48152/ws'

  connect(): void {
    this.shouldRun = true
    this.clearReconnectTimer()

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.connectionSubject.next({ status: 'connecting' })

    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempt = 0
      this.connectionSubject.next({ status: 'connected' })
    }

    ws.onclose = () => {
      this.ws = null
      this.connectionSubject.next({ status: 'disconnected' })
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      if (!this.shouldRun) return
      this.connectionSubject.next({ status: 'disconnected', error: 'WebSocket error' })
    }

    ws.onmessage = evt => {
      const text = typeof evt.data === 'string' ? evt.data : ''
      if (!text.length) return

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return
      }

      if (!isValidActaMessage(parsed)) return
      if (!validatePayload(parsed.type, parsed.payload)) return

      this.messagesSubject.next(parsed)
    }
  }

  disconnect(): void {
    this.shouldRun = false
    this.clearReconnectTimer()

    const ws = this.ws
    this.ws = null

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close()
    }

    this.connectionSubject.next({ status: 'disconnected' })
  }

  sendTaskRequest(payload: TaskRequest, opts?: { profileId?: string; correlationId?: string }): string {
    const correlationId = opts?.correlationId ?? this.newId()

    const msg: ActaMessage<TaskRequest> = {
      id: this.newId(),
      type: 'task.request',
      source: 'ui',
      timestamp: Date.now(),
      payload,
      correlationId,
      profileId: opts?.profileId,
    }

    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Runtime IPC is not connected')
    }

    ws.send(JSON.stringify(msg))
    return correlationId
  }

  sendPermissionResponse(
    payload: { requestId: string; decision: 'allow' | 'deny'; remember?: boolean },
    opts: { profileId?: string; correlationId: string; replyTo: string },
  ): void {
    const msg: ActaMessage<typeof payload> = {
      id: this.newId(),
      type: 'permission.response',
      source: 'ui',
      timestamp: Date.now(),
      payload,
      correlationId: opts.correlationId,
      profileId: opts.profileId,
      replyTo: opts.replyTo,
    }

    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Runtime IPC is not connected')
    }

    ws.send(JSON.stringify(msg))
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return
    this.clearReconnectTimer()

    const attempt = Math.min(this.reconnectAttempt, 6)
    const delayMs = Math.min(30_000, 500 * 2 ** attempt)
    this.reconnectAttempt += 1

    this.reconnectTimer = setTimeout(() => {
      if (!this.shouldRun) return
      this.connect()
    }, delayMs)
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private newId(): string {
    const c = (globalThis as any).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}
