import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ProfilesStateService } from '../../../state/profiles-state.service'

@Component({
  selector: 'acta-manage-profiles-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-profiles-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class ManageProfilesModalComponent {
  constructor(public profiles: ProfilesStateService) {}
}
