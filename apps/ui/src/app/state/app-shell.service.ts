/*
  * Code Map: App Shell Bootstrap
  * - AppShellService: One-time startup orchestrator for initial UI state
  * - init(): Refreshes profiles, trust/setup state, and runtime ping; seeds initial chat
  *
  * CID Index:
  * CID:app-shell.service-001 -> AppShellService (bootstrap orchestration)
  * CID:app-shell.service-002 -> init (startup sequence)
  *
  * Lookup: rg -n "CID:app-shell.service-" apps/ui/src/app/state/app-shell.service.ts
  */

import { Injectable } from '@angular/core'
import { ChatStateService } from './chat-state.service'
import { ProfilesActionsService } from './profiles-actions.service'
import { ProfilesStateService } from './profiles-state.service'
import { RuntimeEventsService } from './runtime-events.service'
import { RuntimeStatusService } from './runtime-status.service'
import { SetupStateService } from './setup-state.service'
import { TrustStateService } from './trust-state.service'

 // CID:app-shell.service-001 - App Shell Bootstrap Orchestrator
 // Purpose: Runs an initial startup sequence to bring core UI state in sync with the runtime.
 // Uses: ChatStateService, ProfilesActionsService, TrustStateService, SetupStateService, RuntimeStatusService
 // Used by: Root DI graph (constructed at app startup)
 @Injectable({ providedIn: 'root' })
 export class AppShellService {
  constructor(
    private chat: ChatStateService,
    private profilesActions: ProfilesActionsService,
    _profiles: ProfilesStateService,
    private trust: TrustStateService,
    private setup: SetupStateService,
    _runtimeEvents: RuntimeEventsService,
    private runtimeStatus: RuntimeStatusService,
  ) {
    void this.init()
  }

  // CID:app-shell.service-002 - Startup Sequence
  // Purpose: Refreshes core state and seeds initial chat messages on first load.
  // Uses: ProfilesActionsService.refresh(), TrustStateService.loadTrustLevel(), SetupStateService.loadConfigAndMaybeOpenWizard(), RuntimeStatusService.refreshPing()
  // Used by: AppShellService constructor
  private async init(): Promise<void> {
    await this.profilesActions.refresh()
    await this.trust.loadTrustLevel()
    await this.setup.loadConfigAndMaybeOpenWizard()
    await this.runtimeStatus.refreshPing()

    const now = Date.now()
    if (this.chat.messages.length === 0) {
      this.chat.addSystemMessage('Renderer ready.', now)
      this.chat.addSystemMessage(`Electron IPC: ${this.runtimeStatus.pingStatus}`, now + 1)
    }
  }
}
