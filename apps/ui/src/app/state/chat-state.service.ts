import { Injectable } from '@angular/core'
import type { ActaMessage } from '@acta/ipc'
import { RuntimeIpcService } from '../runtime-ipc.service'
import type { Attachment, ChatMessage, ChatMessageType, ChatPlanStep, PlanStepStatus } from '../models/ui.models'
import { SessionService } from './session.service'

@Injectable({ providedIn: 'root' })
export class ChatStateService {
  draft = ''
  pendingAttachments: Attachment[] = []
  messages: ChatMessage[] = []

  private planMessageIdByCorrelation = new Map<string, string>()

  constructor(
    private runtimeIpc: RuntimeIpcService,
    private session: SessionService,
  ) {}

  addSystemMessage(text: string, timestamp = Date.now()): void {
    this.messages = [...this.messages, this.makeMessage('system', text, timestamp)]
  }

  handleTaskPlanMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.plan') return

    const correlationId = msg.correlationId
    if (typeof correlationId !== 'string' || !correlationId.length) return

    const plan = msg.payload as any
    if (!plan || typeof plan.goal !== 'string' || !Array.isArray(plan.steps)) return

    const now = Date.now()
    const mappedSteps: ChatPlanStep[] = plan.steps.map((s: any) => ({
      id: String(s?.id ?? this.newId()),
      title: String(s?.intent ?? s?.tool ?? 'step'),
      status: 'pending',
    }))

    const existingId = this.planMessageIdByCorrelation.get(correlationId)
    if (existingId) {
      this.messages = this.messages.map(m => {
        if (m.id !== existingId) return m
        return {
          ...m,
          text: `I can do that. Here's the plan:`,
          plan: {
            goal: plan.goal,
            collapsed: false,
            steps: mappedSteps,
          },
        }
      })
      return
    }

    const planMsg: ChatMessage = {
      id: this.newId(),
      type: 'acta',
      timestamp: now,
      text: `I can do that. Here's the plan:`,
      plan: {
        goal: plan.goal,
        collapsed: false,
        steps: mappedSteps,
      },
    }

    this.planMessageIdByCorrelation.set(correlationId, planMsg.id)
    this.messages = [...this.messages, planMsg]
  }

  handleTaskStepMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.step') return

    const correlationId = msg.correlationId
    if (typeof correlationId !== 'string' || !correlationId.length) return

    const planMessageId = this.planMessageIdByCorrelation.get(correlationId)
    if (!planMessageId) return

    const step = msg.payload as any
    const stepId = String(step?.stepId ?? '')
    const status = String(step?.status ?? '')
    if (!stepId.length) return

    const mappedStatus: PlanStepStatus | null =
      status === 'start' ? 'in-progress' : status === 'completed' ? 'completed' : status === 'error' ? 'failed' : null

    if (!mappedStatus) return

    this.messages = this.messages.map(m => {
      if (m.id !== planMessageId) return m
      if (!m.plan) return m
      return {
        ...m,
        plan: {
          ...m.plan,
          steps: m.plan.steps.map(s => (s.id === stepId ? { ...s, status: mappedStatus } : s)),
        },
      }
    })
  }

  handleTaskResultMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.result') return
    this.addSystemMessage('Task completed.')
  }

  handleTaskErrorMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.error') return
    const err = msg.payload as any
    this.addSystemMessage(`Task error: ${String(err?.message ?? 'unknown')}`)
  }

  togglePlan(messageId: string): void {
    this.messages = this.messages.map(msg => {
      if (msg.id !== messageId) return msg
      if (!msg.plan) return msg
      return {
        ...msg,
        plan: {
          ...msg.plan,
          collapsed: !msg.plan.collapsed,
        },
      }
    })
  }

  onDraftKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    if (event.isComposing) return

    event.preventDefault()
    this.send()
  }

  onSubmit(event: Event): void {
    event.preventDefault()
    this.send()
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement
    this.addAttachments(input.files)
    input.value = ''
  }

  removePendingAttachment(id: string): void {
    this.pendingAttachments = this.pendingAttachments.filter(a => a.id !== id)
  }

  canSend(): boolean {
    return this.draft.trim().length > 0 || this.pendingAttachments.length > 0
  }

  send(): void {
    const text = this.draft.trim()
    const attachments = this.pendingAttachments.length ? [...this.pendingAttachments] : undefined

    if (!text && !attachments) return

    const now = Date.now()
    const taskId = this.newId()

    const userMsg: ChatMessage = {
      id: this.newId(),
      type: 'user',
      timestamp: now,
      text: text || 'Sent attachments.',
      attachments,
    }

    try {
      const files = attachments
        ? attachments
            .map(a => a.path)
            .filter((p): p is string => typeof p === 'string' && p.length > 0)
        : undefined

      this.runtimeIpc.sendTaskRequest(
        {
          input: text || 'Sent attachments.',
          context: files && files.length ? { files } : undefined,
        },
        {
          profileId: this.session.profileId,
          correlationId: taskId,
        },
      )

      const planPlaceholderId = this.newId()
      this.planMessageIdByCorrelation.set(taskId, planPlaceholderId)

      const pendingMsg: ChatMessage = {
        id: this.newId(),
        type: 'system',
        timestamp: now + 1,
        text: 'Task sent to runtime. Waiting for plan…',
      }

      const planPlaceholder: ChatMessage = {
        id: planPlaceholderId,
        type: 'acta',
        timestamp: now + 2,
        text: 'Planning…',
        plan: {
          goal: 'Planning…',
          collapsed: false,
          steps: [],
        },
      }

      this.messages = [...this.messages, userMsg, pendingMsg, planPlaceholder]
      this.draft = ''
      this.pendingAttachments = []
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Runtime is not connected'
      const errorMsg = this.makeMessage(
        'system',
        `Could not send task: ${reason}. Please check the runtime and try again.`,
        now + 1,
      )

      this.messages = [...this.messages, userMsg, errorMsg]
    }
  }

  private addAttachments(files: FileList | null): void {
    if (!files || files.length === 0) return

    const next: Attachment[] = Array.from(files).map(file => {
      const maybePath = (file as File & { path?: string }).path
      return {
        id: this.newId(),
        name: file.name,
        size: file.size,
        path: maybePath,
      }
    })

    this.pendingAttachments = [...this.pendingAttachments, ...next]

    this.addSystemMessage(
      `Attached ${next.length} file${next.length === 1 ? '' : 's'}. Permission may be required to read it.`,
      Date.now(),
    )
  }

  private makeMessage(type: ChatMessageType, text: string, timestamp: number): ChatMessage {
    return {
      id: this.newId(),
      type,
      timestamp,
      text,
    }
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}
