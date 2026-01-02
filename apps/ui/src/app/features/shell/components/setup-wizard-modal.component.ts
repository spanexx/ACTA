import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ProfilesStateService } from '../../../state/profiles-state.service'
import { SetupStateService } from '../../../state/setup-state.service'
import { TrustStateService } from '../../../state/trust-state.service'

@Component({
  selector: 'acta-setup-wizard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-wizard-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class SetupWizardModalComponent {
  constructor(
    public profiles: ProfilesStateService,
    public setup: SetupStateService,
    public trust: TrustStateService,
  ) {}

  trackByString(_index: number, value: string): string {
    return value
  }

  setupSummary(): string {
    return this.setup.summary(this.trust.trustModeLabel.bind(this.trust))
  }
}
