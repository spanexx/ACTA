import { Injectable } from '@angular/core'
import type { TrustLevel } from '../models/ui.models'
import { ChatStateService } from './chat-state.service'
import { PermissionStateService } from './permission-state.service'
import { SessionService } from './session.service'

@Injectable({ providedIn: 'root' })
export class TrustStateService {
  level: TrustLevel = 1
  selection: TrustLevel = 1
  busy = false
  confirmOpen = false
  pending: TrustLevel | null = null

  constructor(
    private session: SessionService,
    private chat: ChatStateService,
    private permission: PermissionStateService,
  ) {}

  async loadTrustLevel(): Promise<void> {
    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.getTrustLevel()
      this.level = res.trustLevel
      this.selection = res.trustLevel
      this.session.setProfileId(res.profileId)
      this.session.setTrustLevel(res.trustLevel)
    } catch {
      // ignore (UI scaffold only)
    }
  }

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

  async apply(level: TrustLevel): Promise<void> {
    if (this.busy) return

    this.busy = true

    try {
      if (!window.ActaAPI) {
        this.selection = this.level
        return
      }

      const res = await window.ActaAPI.setTrustLevel({ trustLevel: level })
      this.level = res.trustLevel
      this.selection = res.trustLevel
      this.session.setProfileId(res.profileId)
      this.session.setTrustLevel(res.trustLevel)

      this.chat.addSystemMessage(
        `Trust level set to ${this.trustModeLabel(res.trustLevel)} for profile ${res.profileId}.`,
        Date.now(),
      )
    } catch {
      this.selection = this.level
    } finally {
      this.busy = false
    }
  }

  trustModeLabel(level: number): string {
    if (level <= 0) return 'Deny (0)'
    if (level === 1) return 'Ask every time (1)'
    if (level === 2) return 'Ask once (2)'
    if (level === 3) return 'Allow (3)'
    return `Trust level ${level}`
  }
}
