import { Injectable, NgZone } from '@angular/core'
import type { ProfileInfo } from '../models/ui.models'
import { ChatStateService } from './chat-state.service'
import { RuntimeIpcService } from '../runtime-ipc.service'
import { SessionService } from './session.service'
import { SetupStateService } from './setup-state.service'
import { ToolOutputsStateService } from './tool-outputs-state.service'
import { TrustStateService } from './trust-state.service'

@Injectable({ providedIn: 'root' })
export class ProfilesStateService {
  profileId = 'default'
  profiles: ProfileInfo[] = []
  selection = 'default'
  busy = false

  manageOpen = false
  newProfileName = ''

  deleteOpen = false
  deleteProfileId: string | null = null
  deleteProfileFiles = false

  switchConfirmOpen = false
  pendingProfileId: string | null = null

  constructor(
    private zone: NgZone,
    private runtimeIpc: RuntimeIpcService,
    private session: SessionService,
    private toolOutputs: ToolOutputsStateService,
    private trust: TrustStateService,
    private setup: SetupStateService,
    private chat: ChatStateService,
  ) {
  }

  async refresh(): Promise<void> {
    if (this.busy) return
    this.busy = true

    try {
      const list = await this.runtimeIpc.profileList()
      const active = list.profiles.find(p => p.active) ?? null

      this.profiles = list.profiles.map(p => ({
        id: p.id,
        name: p.name,
        isActive: p.active,
        dataPath: '',
      }))

      const activeId = active?.id ?? (this.profiles[0]?.id ?? 'default')
      this.profileId = activeId
      this.selection = activeId
      this.session.setProfileId(activeId)
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.busy = false
    }
  }

  async onSelectionChange(next: string): Promise<void> {
    if (this.busy) return
    const desired = (next ?? '').trim()
    if (!desired.length) return

    if (desired === this.profileId) {
      this.selection = this.profileId
      return
    }

    if (this.toolOutputs.isToolRunActive()) {
      this.pendingProfileId = desired
      this.switchConfirmOpen = true
      this.selection = this.profileId
      return
    }

    await this.switchTo(desired)
  }

  cancelSwitch(): void {
    this.switchConfirmOpen = false
    this.pendingProfileId = null
    this.selection = this.profileId
  }

  async confirmSwitch(): Promise<void> {
    if (!this.pendingProfileId) return
    const next = this.pendingProfileId
    this.switchConfirmOpen = false
    this.pendingProfileId = null
    await this.switchTo(next)
  }

  openManage(): void {
    this.manageOpen = true
  }

  closeManage(): void {
    this.manageOpen = false
    this.newProfileName = ''
  }

  async create(): Promise<void> {
    const name = this.newProfileName.trim()
    if (!name.length) return
    if (this.busy) return

    this.busy = true
    try {
      await this.runtimeIpc.profileCreate({ name })
      this.newProfileName = ''
      await this.refresh()
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.busy = false
    }
  }

  requestDelete(profileId: string): void {
    if (!profileId.length) return
    if (profileId === 'default') return
    this.deleteProfileId = profileId
    this.deleteProfileFiles = false
    this.deleteOpen = true
  }

  cancelDelete(): void {
    this.deleteOpen = false
    this.deleteProfileId = null
    this.deleteProfileFiles = false
  }

  async confirmDelete(): Promise<void> {
    if (!this.deleteProfileId) return
    if (this.busy) return

    const profileId = this.deleteProfileId
    const deleteFiles = this.deleteProfileFiles

    this.busy = true
    try {
      await this.runtimeIpc.profileDelete({ profileId, deleteFiles })
      this.cancelDelete()
      await this.refresh()
      await this.trust.loadTrustLevel()
      await this.setup.loadConfigAndMaybeOpenWizard()
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.busy = false
    }
  }

  trackByProfileId(_index: number, profile: ProfileInfo): string {
    return profile.id
  }

  private async switchTo(profileId: string): Promise<void> {
    if (this.busy) return
    this.busy = true

    try {
      const res = await this.runtimeIpc.profileSwitch({ profileId })
      this.profileId = res.profile.id
      this.selection = res.profile.id
      this.session.setProfileId(res.profile.id)

      await this.trust.loadTrustLevel()
      await this.setup.loadConfigAndMaybeOpenWizard()

      this.chat.addSystemMessage(`Switched to profile ${res.profile.id}.`, Date.now())
    } catch {
      this.selection = this.profileId
    } finally {
      this.busy = false
    }
  }
}
