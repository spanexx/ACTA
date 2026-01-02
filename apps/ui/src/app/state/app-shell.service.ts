import { Injectable } from '@angular/core'
import { ChatStateService } from './chat-state.service'
import { ProfilesStateService } from './profiles-state.service'
import { RuntimeEventsService } from './runtime-events.service'
import { RuntimeStatusService } from './runtime-status.service'
import { SetupStateService } from './setup-state.service'
import { TrustStateService } from './trust-state.service'

@Injectable({ providedIn: 'root' })
export class AppShellService {
  constructor(
    private chat: ChatStateService,
    private profiles: ProfilesStateService,
    private trust: TrustStateService,
    private setup: SetupStateService,
    _runtimeEvents: RuntimeEventsService,
    private runtimeStatus: RuntimeStatusService,
  ) {
    void this.init()
  }

  private async init(): Promise<void> {
    await this.profiles.refresh()
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
