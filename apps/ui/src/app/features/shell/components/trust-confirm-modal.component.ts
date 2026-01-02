import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { ProfilesStateService } from '../../../state/profiles-state.service'
import { TrustStateService } from '../../../state/trust-state.service'

@Component({
  selector: 'acta-trust-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trust-confirm-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class TrustConfirmModalComponent {
  constructor(
    public profiles: ProfilesStateService,
    public trust: TrustStateService,
  ) {}
}
