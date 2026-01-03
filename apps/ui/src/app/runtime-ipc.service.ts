import { Injectable } from '@angular/core'
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
import { RuntimeIpcCore, type RuntimeConnectionState } from './runtime-ipc/runtime-ipc-core'

export type { RuntimeConnectionState }

@Injectable({ providedIn: 'root' })
export class RuntimeIpcService {
  private core = new RuntimeIpcCore()

  readonly connection$ = this.core.connection$
  readonly messages$ = this.core.messages$
  readonly url = this.core.url

  connect(): void {
    this.core.connect()
  }

  disconnect(): void {
    this.core.disconnect()
  }

  sendTaskRequest(payload: TaskRequest, opts?: { profileId?: string; correlationId?: string }): string {
    return this.core.sendTaskRequest(payload, opts)
  }

  sendTaskStop(payload: TaskStopRequest, opts?: { profileId?: string; correlationId?: string }): void {
    this.core.sendTaskStop(payload, opts)
  }

  sendPermissionResponse(
    payload: { requestId: string; decision: 'allow' | 'deny'; remember?: boolean },
    opts: { profileId?: string; correlationId: string; replyTo: string },
  ): void {
    this.core.sendPermissionResponse(payload, opts)
  }

  async request<TPayload>(
    type: ActaMessageType,
    payload: TPayload,
    opts?: { profileId?: string; correlationId?: string; timeoutMs?: number },
  ): Promise<ActaMessage> {
    return await this.core.request(type, payload, opts)
  }

  async profileActive(): Promise<ProfileActivePayload> {
    return await this.core.profileActive()
  }

  async profileList(): Promise<ProfileListPayload> {
    return await this.core.profileList()
  }

  async profileCreate(payload: ProfileCreateRequest): Promise<ProfileCreatePayload> {
    return await this.core.profileCreate(payload)
  }

  async profileDelete(payload: ProfileDeleteRequest): Promise<ProfileDeletePayload> {
    return await this.core.profileDelete(payload)
  }

  async profileSwitch(payload: ProfileSwitchRequest): Promise<ProfileSwitchPayload> {
    return await this.core.profileSwitch(payload)
  }

  async profileGet(payload: ProfileGetRequest): Promise<ProfileGetPayload> {
    return await this.core.profileGet(payload)
  }

  async profileUpdate(payload: ProfileUpdateRequest): Promise<ProfileUpdatePayload> {
    return await this.core.profileUpdate(payload)
  }
}
