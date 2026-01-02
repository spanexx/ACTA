import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import type { ToolOutputArtifact, ToolOutputEntry } from '../../models/ui.models'
import { ToolOutputsStateService } from '../../state/tool-outputs-state.service'

@Component({
  selector: 'acta-tool-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tool-panel.component.html',
})
export class ToolPanelComponent {
  constructor(public toolOutputs: ToolOutputsStateService) {}

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  trackByToolOutputId(_index: number, out: ToolOutputEntry): string {
    return out.id
  }

  trackByArtifactPath(_index: number, artifact: ToolOutputArtifact): string {
    return artifact.path
  }
}
