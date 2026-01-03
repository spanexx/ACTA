import { Injectable } from '@angular/core'
import { BehaviorSubject, Subject } from 'rxjs'
import {
  isValidActaMessage,
  validatePayload,
  type ActaMessage,
  type ActaMessageType,
  type ProfileActivePayload,
  type ProfileCreatePayload,
  type ProfileCreateRequest,
  type ProfileDeletePayload,
  type ProfileDeleteRequest,
  type ProfileGetPayload,
  type ProfileGetRequest,
  type ProfileListPayload,
  type ProfileUpdatePayload,
  type ProfileUpdateRequest,
  type ProfileSwitchPayload,
  type ProfileSwitchRequest,
  type TaskRequest,
  type TaskStopRequest,
} from '@acta/ipc'

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

  private pending = new Map<string, (msg: ActaMessage) => void>()

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

      const replyTo = typeof parsed.replyTo === 'string' ? parsed.replyTo : ''
      if (replyTo.length) {
        const resolver = this.pending.get(replyTo)
        if (resolver) {
          this.pending.delete(replyTo)
          resolver(parsed)
          return
        }
      }

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

  sendTaskStop(payload: TaskStopRequest, opts?: { profileId?: string; correlationId?: string }): void {
    const correlationId = opts?.correlationId ?? payload.correlationId ?? this.newId()

    const msg: ActaMessage<TaskStopRequest> = {
      id: this.newId(),
      type: 'task.stop',
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

  async request<TPayload>(
    type: ActaMessageType,
    payload: TPayload,
    opts?: { profileId?: string; correlationId?: string; timeoutMs?: number },
  ): Promise<ActaMessage> {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Runtime IPC is not connected')
    }

    const id = this.newId()
    const correlationId = opts?.correlationId ?? id
    const timeoutMs = opts?.timeoutMs ?? 7_500

    const msg: ActaMessage<TPayload> = {
      id,
      type,
      source: 'ui',
      timestamp: Date.now(),
      payload,
      correlationId,
      profileId: opts?.profileId,
    }

    return await new Promise<ActaMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('Runtime IPC request timeout'))
      }, timeoutMs)

      this.pending.set(id, reply => {
        clearTimeout(timeout)
        resolve(reply)
      })

      ws.send(JSON.stringify(msg))
    })
  }

  async profileActive(): Promise<ProfileActivePayload> {
    const reply = await this.request('profile.active', {})
    return reply.payload as ProfileActivePayload
  }

  async profileList(): Promise<ProfileListPayload> {
    const reply = await this.request('profile.list', {})
    return reply.payload as ProfileListPayload
  }

  async profileCreate(payload: ProfileCreateRequest): Promise<ProfileCreatePayload> {
    const reply = await this.request('profile.create', payload)
    return reply.payload as ProfileCreatePayload
  }

  async profileDelete(payload: ProfileDeleteRequest): Promise<ProfileDeletePayload> {
    const reply = await this.request('profile.delete', payload)
    return reply.payload as ProfileDeletePayload
  }

  async profileSwitch(payload: ProfileSwitchRequest): Promise<ProfileSwitchPayload> {
    const reply = await this.request('profile.switch', payload)
    return reply.payload as ProfileSwitchPayload
  }

  async profileGet(payload: ProfileGetRequest): Promise<ProfileGetPayload> {
    const reply = await this.request('profile.get', payload)
    return reply.payload as ProfileGetPayload
  }

  async profileUpdate(payload: ProfileUpdateRequest): Promise<ProfileUpdatePayload> {
    const reply = await this.request('profile.update', payload)
    return reply.payload as ProfileUpdatePayload
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
