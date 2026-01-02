import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { PermissionStateService } from '../../state/permission-state.service'

@Component({
  selector: 'acta-permission-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permission-modal.component.html',
})
export class PermissionModalComponent {
  constructor(public permission: PermissionStateService) {}
}
