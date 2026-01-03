/*
  * Code Map: Profiles Actions
  * - ProfilesActionsService: Implements UI actions for listing/creating/deleting/switching profiles.
  * - refresh(): Syncs profiles list + active selection from runtime.
  * - onSelectionChange(): Handles profile selection and (if needed) switch confirmation.
  * - create/delete flows: Mutate profiles via IPC and refresh dependent state.
  *
  * CID Index:
  * CID:profiles-actions.service-001 -> ProfilesActionsService (action orchestrator)
  * CID:profiles-actions.service-002 -> refresh
  * CID:profiles-actions.service-003 -> onSelectionChange
  * CID:profiles-actions.service-004 -> cancelSwitch/confirmSwitch
  * CID:profiles-actions.service-005 -> openManage/closeManage
  * CID:profiles-actions.service-006 -> create
  * CID:profiles-actions.service-007 -> requestDelete/cancelDelete/confirmDelete
  * CID:profiles-actions.service-008 -> switchTo
  *
  * Lookup: rg -n "CID:profiles-actions.service-" apps/ui/src/app/state/profiles-actions.service.ts
  */

import { Injectable } from '@angular/core'
import { RuntimeIpcService } from '../runtime-ipc.service'
import { ChatStateService } from './chat-state.service'
import { ProfilesStateService } from './profiles-state.service'
import { SessionService } from './session.service'
import { SetupStateService } from './setup-state.service'
import { ToolOutputsStateService } from './tool-outputs-state.service'
import { TrustStateService } from './trust-state.service'
import { createProfile, deleteProfile } from './profiles-state/create-delete'
import { refreshProfiles } from './profiles-state/refresh'
import { shouldConfirmSwitch, switchToProfile } from './profiles-state/switching'

// CID:profiles-actions.service-001 - Profiles Actions Orchestrator
// Purpose: Coordinates profile-related UI actions and keeps related state services in sync.
// Uses: ProfilesStateService, RuntimeIpcService, SessionService, ToolOutputsStateService, TrustStateService, SetupStateService, ChatStateService
// Used by: Shell UI components (profiles dropdown/modals); AppShellService init
@Injectable({ providedIn: 'root' })
export class ProfilesActionsService {
  constructor(
    private profiles: ProfilesStateService,
    private runtimeIpc: RuntimeIpcService,
    private session: SessionService,
    private toolOutputs: ToolOutputsStateService,
    private trust: TrustStateService,
    private setup: SetupStateService,
    private chat: ChatStateService,
  ) {}

  // CID:profiles-actions.service-002 - Refresh Profiles
  // Purpose: Fetches profile list from runtime, updates session/profile selection state.
  // Uses: refreshProfiles(), RuntimeIpcService.profileList(), SessionService.setProfileId()
  // Used by: AppShellService init; UI refresh actions
  async refresh(): Promise<void> {
    if (this.profiles.busy) return
    this.profiles.busy = true

    try {
      const res = await refreshProfiles({
        runtimeIpc: this.runtimeIpc,
        session: this.session,
        current: {
          busy: this.profiles.busy,
          profileId: this.profiles.profileId,
          profiles: this.profiles.profiles,
          selection: this.profiles.selection,
        },
      })

      if (res) {
        this.profiles.profiles = res.nextProfiles
        this.profiles.profileId = res.nextProfileId
        this.profiles.selection = res.nextSelection
      }
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.profiles.busy = false
    }
  }

  // CID:profiles-actions.service-003 - Handle Profile Selection
  // Purpose: Applies selection change; may open confirmation if tools are running.
  // Uses: shouldConfirmSwitch(), ToolOutputsStateService.isToolRunActive(), switchTo()
  // Used by: Profiles dropdown UI
  async onSelectionChange(next: string): Promise<void> {
    if (this.profiles.busy) return
    const desired = (next ?? '').trim()
    if (!desired.length) return

    if (desired === this.profiles.profileId) {
      this.profiles.selection = this.profiles.profileId
      return
    }

    if (
      shouldConfirmSwitch({
        busy: this.profiles.busy,
        desired,
        currentProfileId: this.profiles.profileId,
        toolOutputs: this.toolOutputs,
      })
    ) {
      this.profiles.pendingProfileId = desired
      this.profiles.switchConfirmOpen = true
      this.profiles.selection = this.profiles.profileId
      return
    }

    await this.switchTo(desired)
  }

  // CID:profiles-actions.service-004 - Switch Confirmation Actions
  // Purpose: Cancels or confirms a pending profile switch.
  // Uses: switchTo()
  // Used by: Profile switch confirm modal
  cancelSwitch(): void {
    this.profiles.switchConfirmOpen = false
    this.profiles.pendingProfileId = null
    this.profiles.selection = this.profiles.profileId
  }

  async confirmSwitch(): Promise<void> {
    if (!this.profiles.pendingProfileId) return
    const next = this.profiles.pendingProfileId
    this.profiles.switchConfirmOpen = false
    this.profiles.pendingProfileId = null
    await this.switchTo(next)
  }

  // CID:profiles-actions.service-005 - Manage Modal Open/Close
  // Purpose: Opens/closes the profile management modal and resets transient fields.
  // Uses: ProfilesStateService flags/fields
  // Used by: Manage profiles modal
  openManage(): void {
    this.profiles.manageOpen = true
  }

  closeManage(): void {
    this.profiles.manageOpen = false
    this.profiles.newProfileName = ''
  }

  // CID:profiles-actions.service-006 - Create Profile
  // Purpose: Creates a new profile via IPC and refreshes the profile list.
  // Uses: createProfile(), RuntimeIpcService.profileCreate(), refresh()
  // Used by: Manage profiles modal
  async create(): Promise<void> {
    const name = this.profiles.newProfileName.trim()
    if (!name.length) return
    if (this.profiles.busy) return

    this.profiles.busy = true
    try {
      const ok = await createProfile({ runtimeIpc: this.runtimeIpc, name })
      if (ok) {
        this.profiles.newProfileName = ''
        await this.refresh()
      }
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.profiles.busy = false
    }
  }

  // CID:profiles-actions.service-007 - Delete Profile Flow
  // Purpose: Opens delete confirmation UI and performs deletion via IPC.
  // Uses: deleteProfile(), RuntimeIpcService.profileDelete(), TrustStateService.loadTrustLevel(), SetupStateService.loadConfigAndMaybeOpenWizard(), refresh()
  // Used by: Delete profile modal
  requestDelete(profileId: string): void {
    if (!profileId.length) return
    if (profileId === 'default') return
    this.profiles.deleteProfileId = profileId
    this.profiles.deleteProfileFiles = false
    this.profiles.deleteOpen = true
  }

  cancelDelete(): void {
    this.profiles.deleteOpen = false
    this.profiles.deleteProfileId = null
    this.profiles.deleteProfileFiles = false
  }

  async confirmDelete(): Promise<void> {
    if (!this.profiles.deleteProfileId) return
    if (this.profiles.busy) return

    const profileId = this.profiles.deleteProfileId
    const deleteFiles = this.profiles.deleteProfileFiles

    this.profiles.busy = true
    try {
      const ok = await deleteProfile({
        runtimeIpc: this.runtimeIpc,
        trust: this.trust,
        setup: this.setup,
        profileId,
        deleteFiles,
      })

      if (ok) {
        this.cancelDelete()
        await this.refresh()
      }
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.profiles.busy = false
    }
  }

  // CID:profiles-actions.service-008 - Execute Profile Switch
  // Purpose: Switches active profile via IPC and refreshes dependent state (trust/setup/chat).
  // Uses: switchToProfile(), RuntimeIpcService.profileSwitch(), SessionService.setProfileId(), ChatStateService.addSystemMessage()
  // Used by: onSelectionChange(), confirmSwitch()
  private async switchTo(profileId: string): Promise<void> {
    if (this.profiles.busy) return
    this.profiles.busy = true

    try {
      const res = await switchToProfile({
        runtimeIpc: this.runtimeIpc,
        session: this.session,
        trust: this.trust,
        setup: this.setup,
        chat: this.chat,
        profileId,
      })

      if (res) {
        this.profiles.profileId = res.profileId
        this.profiles.selection = res.profileId
      } else {
        this.profiles.selection = this.profiles.profileId
      }
    } catch {
      this.profiles.selection = this.profiles.profileId
    } finally {
      this.profiles.busy = false
    }
  }
}
