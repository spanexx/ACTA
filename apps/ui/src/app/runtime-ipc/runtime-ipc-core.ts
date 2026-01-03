/*
 Code Map — runtime-ipc-core

 Responsibilities:
 - Own the runtime WebSocket lifecycle (connect/disconnect, reconnect/backoff).
 - Parse + validate incoming IPC messages and fan them out to callers.
 - Track request/reply pairs (pending requests + timeouts).
 - Provide thin convenience wrappers for common RPC calls (profile.*).

 CID index:
 - CID:runtime-ipc-core-001 -> RuntimeConnectionState (public connection status shape)
 - CID:runtime-ipc-core-002 -> RuntimeIpcCore (core transport + request orchestration)
 - CID:runtime-ipc-core-003 -> connect() (open WS + wire handlers)
 - CID:runtime-ipc-core-004 -> disconnect() (stop WS + cleanup)
 - CID:runtime-ipc-core-005 -> sendTaskRequest() (fire-and-forget task.request)
 - CID:runtime-ipc-core-006 -> sendTaskStop() (fire-and-forget task.stop)
 - CID:runtime-ipc-core-007 -> sendPermissionResponse() (permission.response)
 - CID:runtime-ipc-core-008 -> request() (request/response with timeout)
 - CID:runtime-ipc-core-009 -> profile*() (profile RPC helpers)
 - CID:runtime-ipc-core-010 -> scheduleReconnect() (backoff scheduling)
 - CID:runtime-ipc-core-011 -> sendRaw() (WS send guard)

 Lookup:
 - rg -n "CID:runtime-ipc-core-" apps/ui/src/app/runtime-ipc/runtime-ipc-core.ts
*/

import { BehaviorSubject, Subject } from 'rxjs'
import type {
  ActaMessage,
  ActaMessageType,
  ProfileActivePayload,
  ProfileCreatePayload,
  ProfileCreateRequest,
  ProfileDeletePayload,
  ProfileDeleteRequest,
  ProfileGetPayload,
  ProfileGetRequest,
  ProfileListPayload,
  ProfileSwitchPayload,
  ProfileSwitchRequest,
  ProfileUpdatePayload,
  ProfileUpdateRequest,
  TaskRequest,
  TaskStopRequest,
} from '@acta/ipc'
import { parseIncomingActaMessage } from './incoming'
import { newId } from '../shared/ids'
import { PendingRequests } from './pending'
import { ReconnectController } from './reconnect'
import {
  buildPermissionResponseMessage,
  buildRequestMessage,
  buildTaskRequestMessage,
  buildTaskStopMessage,
} from './outgoing'
import { createProfileApi } from './profile-api'

export type RuntimeConnectionState = {
  status: 'disconnected' | 'connecting' | 'connected'
  error?: string
}

// CID:runtime-ipc-core-001
// Purpose: Public connection status surface area for the UI (connection$ consumers).
// Uses: Emitted via BehaviorSubject in RuntimeIpcCore.
// Used by: RuntimeIpcService wrapper; RuntimeStatusService UI binding.

// CID:runtime-ipc-core-002
// Purpose: Core runtime IPC transport + request orchestration (non-Angular; UI wrapper delegates to this).
// Uses: WebSocket, parseIncomingActaMessage(), PendingRequests, ReconnectController, outgoing message builders.
// Used by: apps/ui/src/app/runtime-ipc.service.ts
export class RuntimeIpcCore {
  private ws: WebSocket | null = null
  private shouldRun = false
  private reconnect = new ReconnectController()

  private pending = new PendingRequests()

  private connectionSubject = new BehaviorSubject<RuntimeConnectionState>({ status: 'disconnected' })
  readonly connection$ = this.connectionSubject.asObservable()

  private messagesSubject = new Subject<ActaMessage>()
  readonly messages$ = this.messagesSubject.asObservable()

  readonly url = 'ws://127.0.0.1:48152/ws'

  private profileApi = createProfileApi((type, payload) => this.request(type, payload))

  // CID:runtime-ipc-core-003
  // Purpose: Establish (or reuse) the WS connection to the runtime and wire handlers.
  // Uses: ReconnectController (reset/clear), parseIncomingActaMessage(), PendingRequests.
  // Used by: RuntimeIpcService.connect(); RuntimeEventsService startup.
  connect(): void {
    this.shouldRun = true
    this.reconnect.clear()

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.connectionSubject.next({ status: 'connecting' })

    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      this.reconnect.reset()
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
      const parsed = parseIncomingActaMessage(evt.data)
      if (!parsed) return

      if (this.pending.resolveIfPending(parsed)) return
      this.messagesSubject.next(parsed)
    }
  }

  // CID:runtime-ipc-core-004
  // Purpose: Tear down the WS connection and stop reconnect attempts.
  // Uses: ReconnectController.clear(); WS.close(); connectionSubject.
  // Used by: RuntimeIpcService.disconnect(); RuntimeEventsService.disconnect().
  disconnect(): void {
    this.shouldRun = false
    this.reconnect.clear()

    const ws = this.ws
    this.ws = null

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close()
    }

    this.connectionSubject.next({ status: 'disconnected' })
  }

  // CID:runtime-ipc-core-005
  // Purpose: Send a task.request message (fire-and-forget) and return correlationId.
  // Uses: outgoing builder + sendRaw(); newId() for correlation/id.
  // Used by: ChatStateService -> RuntimeIpcService.sendTaskRequest().
  sendTaskRequest(payload: TaskRequest, opts?: { profileId?: string; correlationId?: string }): string {
    const correlationId = opts?.correlationId ?? newId()
    const msg = buildTaskRequestMessage({
      id: newId(),
      correlationId,
      payload,
      profileId: opts?.profileId,
    })

    this.sendRaw(msg)
    return correlationId
  }

  // CID:runtime-ipc-core-006
  // Purpose: Send a task.stop message (fire-and-forget).
  // Uses: outgoing builder + sendRaw(); correlation derived from opts/payload.
  // Used by: ChatStateService.stop() -> RuntimeIpcService.sendTaskStop().
  sendTaskStop(payload: TaskStopRequest, opts?: { profileId?: string; correlationId?: string }): void {
    const correlationId = opts?.correlationId ?? payload.correlationId ?? newId()
    const msg = buildTaskStopMessage({
      id: newId(),
      correlationId,
      payload,
      profileId: opts?.profileId,
    })

    this.sendRaw(msg)
  }

  // CID:runtime-ipc-core-007
  // Purpose: Send a permission.response message to reply to a runtime permission.request.
  // Uses: outgoing builder + sendRaw(); relies on opts.replyTo to correlate on runtime side.
  // Used by: PermissionStateService.submit() when responding via runtime IPC.
  sendPermissionResponse(
    payload: { requestId: string; decision: 'allow' | 'deny'; remember?: boolean },
    opts: { profileId?: string; correlationId: string; replyTo: string },
  ): void {
    const msg = buildPermissionResponseMessage({
      id: newId(),
      payload,
      correlationId: opts.correlationId,
      profileId: opts.profileId,
      replyTo: opts.replyTo,
    })

    this.sendRaw(msg)
  }

  // CID:runtime-ipc-core-008
  // Purpose: Generic request/response helper with timeout.
  // Uses: PendingRequests.waitForReply(), outgoing builder, sendRaw().
  // Used by: profile*() wrappers (via createProfileApi) and any future RPC calls.
  async request<TPayload>(
    type: ActaMessageType,
    payload: TPayload,
    opts?: { profileId?: string; correlationId?: string; timeoutMs?: number },
  ): Promise<ActaMessage> {
    const id = newId()
    const correlationId = opts?.correlationId ?? id
    const timeoutMs = opts?.timeoutMs ?? 7_500

    const msg = buildRequestMessage({
      id,
      type,
      payload,
      correlationId,
      profileId: opts?.profileId,
    })

    const replyPromise = this.pending.waitForReply(id, timeoutMs)
    this.sendRaw(msg)
    return await replyPromise
  }

  // CID:runtime-ipc-core-009
  // Purpose: Convenience wrappers around common profile RPC calls.
  // Uses: createProfileApi() which delegates into request().
  // Used by: ProfilesStateService, SetupStateService, TrustStateService.
  async profileActive(): Promise<ProfileActivePayload> {
    return await this.profileApi.profileActive()
  }

  async profileList(): Promise<ProfileListPayload> {
    return await this.profileApi.profileList()
  }

  async profileCreate(payload: ProfileCreateRequest): Promise<ProfileCreatePayload> {
    return await this.profileApi.profileCreate(payload)
  }

  async profileDelete(payload: ProfileDeleteRequest): Promise<ProfileDeletePayload> {
    return await this.profileApi.profileDelete(payload)
  }

  async profileSwitch(payload: ProfileSwitchRequest): Promise<ProfileSwitchPayload> {
    return await this.profileApi.profileSwitch(payload)
  }

  async profileGet(payload: ProfileGetRequest): Promise<ProfileGetPayload> {
    return await this.profileApi.profileGet(payload)
  }

  async profileUpdate(payload: ProfileUpdateRequest): Promise<ProfileUpdatePayload> {
    return await this.profileApi.profileUpdate(payload)
  }

  // CID:runtime-ipc-core-010
  // Purpose: Schedule reconnect attempts with exponential backoff.
  // Uses: ReconnectController.schedule().
  // Used by: connect() WS onclose handler.
  private scheduleReconnect(): void {
    if (!this.shouldRun) return
    this.reconnect.schedule({
      shouldRun: () => this.shouldRun,
      connect: () => this.connect(),
    })
  }

  // CID:runtime-ipc-core-011
  // Purpose: Centralized WS send guard; throws when runtime is not connected.
  // Uses: WebSocket.OPEN readiness check.
  // Used by: sendTaskRequest/sendTaskStop/sendPermissionResponse/request.
  private sendRaw<TPayload>(msg: ActaMessage<TPayload>): void {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Runtime IPC is not connected')
    }
    ws.send(JSON.stringify(msg))
  }
}
