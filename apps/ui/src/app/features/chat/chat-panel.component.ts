import { CommonModule } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import type { Attachment, ChatMessage, ChatMessageType, ChatPlanStep, PlanStepStatus } from '../../models/ui.models'
import { ChatStateService } from '../../state/chat-state.service'

@Component({
  selector: 'acta-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-panel.component.html',
})
export class ChatPanelComponent {
  constructor(public chat: ChatStateService) {}

  labelForType(type: ChatMessageType): string {
    if (type === 'user') return 'You'
    if (type === 'acta') return 'Acta'
    return 'System'
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  planStepIcon(status: PlanStepStatus): string {
    switch (status) {
      case 'pending':
        return '[ ]'
      case 'in-progress':
        return '[►]'
      case 'completed':
        return '[✓]'
      case 'failed':
        return '[✕]'
    }
  }

  fileLabel(file: Attachment): string {
    return file.path ?? file.name
  }

  trackByMessageId(_index: number, msg: ChatMessage): string {
    return msg.id
  }

  trackByAttachmentId(_index: number, file: Attachment): string {
    return file.id
  }

  trackByPlanStepId(_index: number, step: ChatPlanStep): string {
    return step.id
  }
}
