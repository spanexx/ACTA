import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { DemoStateService } from '../../../state/demo-state.service'
import { LogsStateService } from '../../../state/logs-state.service'
import { ProfilesStateService } from '../../../state/profiles-state.service'
import { RuntimeStatusService } from '../../../state/runtime-status.service'
import { SetupStateService } from '../../../state/setup-state.service'
import { TrustStateService } from '../../../state/trust-state.service'

@Component({
  selector: 'acta-shell-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shell-topbar.component.html',
  styles: [':host { display: contents; }'],
})
export class ShellTopbarComponent {
  constructor(
    public runtime: RuntimeStatusService,
    public profiles: ProfilesStateService,
    public trust: TrustStateService,
    public setup: SetupStateService,
    public logs: LogsStateService,
    public demo: DemoStateService,
  ) {}
}
