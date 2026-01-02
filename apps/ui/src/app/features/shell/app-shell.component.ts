import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ChatPanelComponent } from '../chat/chat-panel.component'
import { PermissionModalComponent } from '../permissions/permission-modal.component'
import { ToolPanelComponent } from '../tools/tool-panel.component'
import {
  DeleteProfileModalComponent,
  ManageProfilesModalComponent,
  ProfileSwitchConfirmModalComponent,
  SetupWizardModalComponent,
  ShellTopbarComponent,
  TrustConfirmModalComponent,
} from './components'
import { AppShellService } from '../../state/app-shell.service'
import { DemoStateService } from '../../state/demo-state.service'
import { LogsStateService } from '../../state/logs-state.service'
import { ProfilesStateService } from '../../state/profiles-state.service'
import { RuntimeStatusService } from '../../state/runtime-status.service'
import { SetupStateService } from '../../state/setup-state.service'
import { TrustStateService } from '../../state/trust-state.service'

@Component({
  selector: 'acta-app-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChatPanelComponent,
    ToolPanelComponent,
    PermissionModalComponent,
    ShellTopbarComponent,
    TrustConfirmModalComponent,
    ManageProfilesModalComponent,
    DeleteProfileModalComponent,
    ProfileSwitchConfirmModalComponent,
    SetupWizardModalComponent,
  ],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  constructor(
    _shell: AppShellService,
    public runtime: RuntimeStatusService,
    public profiles: ProfilesStateService,
    public trust: TrustStateService,
    public setup: SetupStateService,
    public logs: LogsStateService,
    public demo: DemoStateService,
  ) {}
}
