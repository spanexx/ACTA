import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ProfilesStateService } from '../../../state/profiles-state.service'

@Component({
  selector: 'acta-delete-profile-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delete-profile-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class DeleteProfileModalComponent {
  constructor(public profiles: ProfilesStateService) {}
}
