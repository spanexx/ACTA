import { Injectable, NgZone } from '@angular/core'
import type { ProfileInfo } from '../models/ui.models'
import { ChatStateService } from './chat-state.service'
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

  private unsubscribe: (() => void) | null = null

  constructor(
    private zone: NgZone,
    private session: SessionService,
    private toolOutputs: ToolOutputsStateService,
    private trust: TrustStateService,
    private setup: SetupStateService,
    private chat: ChatStateService,
  ) {
    this.attachListener()
  }

  async refresh(): Promise<void> {
    if (this.busy) return
    this.busy = true

    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.listProfiles()
      this.profiles = res.profiles
      this.profileId = res.activeProfileId
      this.selection = res.activeProfileId
      this.session.setProfileId(res.activeProfileId)
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
      if (!window.ActaAPI) return
      await window.ActaAPI.createProfile({ name })
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
      if (!window.ActaAPI) return
      await window.ActaAPI.deleteProfile({ profileId, deleteFiles })
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
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.switchProfile({ profileId })
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

  private attachListener(): void {
    if (!window.ActaAPI) return
    if (this.unsubscribe) return

    this.unsubscribe = window.ActaAPI.onProfileChanged(payload => {
      this.zone.run(() => {
        this.profileId = payload.profile.id
        this.selection = payload.profile.id
        this.session.setProfileId(payload.profile.id)
        void this.refresh()
        void this.trust.loadTrustLevel()
        void this.setup.loadConfigAndMaybeOpenWizard()
      })
    })
  }
}
