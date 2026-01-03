/*
 * Code Map: Trust Level State
 * - TrustStateService: Holds trust level UI state and persists trust changes via runtime IPC.
 * - loadTrustLevel(): Loads trust level for current profile.
 * - onSelectionChange(): Applies selection; may open confirmation when increasing trust.
 * - apply(): Persists trust change and emits a system message.
 *
 * CID Index:
 * CID:trust-state.service-001 -> TrustStateService (state container)
 * CID:trust-state.service-002 -> loadTrustLevel
 * CID:trust-state.service-003 -> onSelectionChange
 * CID:trust-state.service-004 -> cancelChange/confirmChange
 * CID:trust-state.service-005 -> apply
 * CID:trust-state.service-006 -> trustModeLabel
 *
 * Lookup: rg -n "CID:trust-state.service-" apps/ui/src/app/state/trust-state.service.ts
 */

import { Injectable } from '@angular/core'
import type { TrustLevel } from '../models/ui.models'
import { RuntimeIpcService } from '../runtime-ipc.service'
import { ChatStateService } from './chat-state.service'
import { PermissionStateService } from './permission-state.service'
import { SessionService } from './session.service'

// CID:trust-state.service-001 - Trust State Container
// Purpose: Stores trust level state and coordinates trust updates with the runtime.
// Uses: RuntimeIpcService (profileGet/profileUpdate), SessionService, ChatStateService, PermissionStateService
// Used by: Trust controls in shell UI; AppShellService init; profile delete/switch flows
@Injectable({ providedIn: 'root' })
export class TrustStateService {
  level: TrustLevel = 1
  selection: TrustLevel = 1
  busy = false
  confirmOpen = false
  pending: TrustLevel | null = null

  constructor(
    private session: SessionService,
    private runtimeIpc: RuntimeIpcService,
    private chat: ChatStateService,
    private permission: PermissionStateService,
  ) {}

  // CID:trust-state.service-002 - Load Trust Level
  // Purpose: Loads trust level from runtime and syncs it into session state.
  // Uses: RuntimeIpcService.profileGet(), SessionService.setProfileId(), SessionService.setTrustLevel()
  // Used by: AppShellService init; profile delete/switch flows
  async loadTrustLevel(): Promise<void> {
    try {
      const res = await this.runtimeIpc.profileGet({})
      const level = res.profile.trust.defaultTrustLevel as any
      this.level = level
      this.selection = level
      this.session.setProfileId(res.profile.id)
      this.session.setTrustLevel(level)
    } catch {
      // ignore (UI scaffold only)
    }
  }

  // CID:trust-state.service-003 - Handle Selection Change
  // Purpose: Applies trust selection changes; may open confirm modal when increasing trust.
  // Uses: PermissionStateService.open (blocks changes while permission modal is open)
  // Used by: Trust controls UI
  async onSelectionChange(next: TrustLevel): Promise<void> {
    if (this.busy) {
      this.selection = this.level
      return
    }

    if (this.permission.open) {
      this.selection = this.level
      return
    }

    if (next > this.level) {
      this.pending = next
      this.confirmOpen = true
      return
    }

    await this.apply(next)
  }

  // CID:trust-state.service-004 - Confirm Modal Actions
  // Purpose: Cancels or confirms a pending trust increase.
  // Uses: apply()
  // Used by: Trust confirm modal
  cancelChange(): void {
    this.confirmOpen = false
    this.pending = null
    this.selection = this.level
  }

  async confirmChange(): Promise<void> {
    if (this.pending === null) return
    const next = this.pending
    await this.apply(next)
    this.confirmOpen = false
    this.pending = null
  }

  // CID:trust-state.service-005 - Persist Trust Level
  // Purpose: Persists trust update via runtime IPC and emits a system message.
  // Uses: RuntimeIpcService.profileUpdate(), ChatStateService.addSystemMessage(), SessionService
  // Used by: onSelectionChange(), confirmChange()
  async apply(level: TrustLevel): Promise<void> {
    if (this.busy) return

    this.busy = true

    try {
      const res = await this.runtimeIpc.profileUpdate({
        profileId: this.session.profileId,
        patch: { trust: { defaultTrustLevel: level as any } },
      })

      const nextLevel = res.profile.trust.defaultTrustLevel as any
      this.level = nextLevel
      this.selection = nextLevel
      this.session.setProfileId(res.profile.id)
      this.session.setTrustLevel(nextLevel)

      this.chat.addSystemMessage(
        `Trust level set to ${this.trustModeLabel(nextLevel)} for profile ${res.profile.id}.`,
        Date.now(),
      )
    } catch {
      this.selection = this.level
    } finally {
      this.busy = false
    }
  }

  // CID:trust-state.service-006 - Trust Mode Label
  // Purpose: Converts numeric trust level to a human-readable label.
  // Uses: simple numeric mapping
  // Used by: UI labels and system messages
  trustModeLabel(level: number): string {
    if (level <= 0) return 'Deny (0)'
    if (level === 1) return 'Ask every time (1)'
    if (level === 2) return 'Ask once (2)'
    if (level === 3) return 'Allow (3)'
    return `Trust level ${level}`
  }
}
