import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { ProfilesActionsService } from '../../../state/profiles-actions.service'
import { ProfilesStateService } from '../../../state/profiles-state.service'

@Component({
  selector: 'acta-profile-switch-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-switch-confirm-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class ProfileSwitchConfirmModalComponent {
  constructor(
    public profiles: ProfilesStateService,
    public profilesActions: ProfilesActionsService,
  ) {}
}
