/*
  * Code Map: Chat State + Task Messaging
  * - ChatStateService: Holds draft/messages/attachments and mediates task-related runtime messages.
  * - Runtime message handlers: task.plan / task.step / task.result / task.error
  * - Composer actions: send/stop, attachment intake, plan toggling
  *
  * CID Index:
  * CID:chat-state.service-001 -> ChatStateService (state container)
  * CID:chat-state.service-002 -> addSystemMessage
  * CID:chat-state.service-003 -> handleTaskPlanMessage
  * CID:chat-state.service-004 -> handleTaskStepMessage
  * CID:chat-state.service-005 -> handleTaskResultMessage
  * CID:chat-state.service-006 -> handleTaskErrorMessage
  * CID:chat-state.service-007 -> canStop/stop (task stop request)
  * CID:chat-state.service-008 -> togglePlan
  * CID:chat-state.service-009 -> composer UI handlers + send
  * CID:chat-state.service-010 -> addAttachments
  * CID:chat-state.service-011 -> clearActiveCorrelation
  *
  * Lookup: rg -n "CID:chat-state.service-" apps/ui/src/app/state/chat-state.service.ts
  */

import { Injectable } from '@angular/core'
import type { ActaMessage } from '@acta/ipc'
import { RuntimeIpcService } from '../runtime-ipc.service'
import type { Attachment, ChatMessage, ChatMessageType, ChatPlanStep, PlanStepStatus } from '../models/ui.models'
import { SessionService } from './session.service'
import { buildAttachments, attachmentNotice } from './chat-state/attachments'
import { sendTaskFromDraft } from './chat-state/composer'
import { makeMessage } from './chat-state/messages'
import { applyTaskPlanMessage, applyTaskStepMessage } from './chat-state/runtime-handlers'

// CID:chat-state.service-001 - Chat State Container
// Purpose: Owns chat UI state (draft/messages/attachments) and routes runtime task messages into UI updates.
// Uses: RuntimeIpcService, SessionService, chat-state helpers (attachments/composer/messages/runtime-handlers)
// Used by: Chat UI components; RuntimeEventsService routes messages here
@Injectable({ providedIn: 'root' })
export class ChatStateService {
  draft = ''
  pendingAttachments: Attachment[] = []
  messages: ChatMessage[] = []

  private planMessageIdByCorrelation = new Map<string, string>()
  private activeCorrelationId: string | null = null

  constructor(
    private runtimeIpc: RuntimeIpcService,
    private session: SessionService,
  ) {}

  // CID:chat-state.service-002 - Append System Message
  // Purpose: Appends a system message to the message list.
  // Uses: makeMessage()
  // Used by: Many state services (setup/trust/profiles/demo/etc.) to surface status to the user
  addSystemMessage(text: string, timestamp = Date.now()): void {
    this.messages = [...this.messages, makeMessage('system', text, timestamp)]
  }

  // CID:chat-state.service-003 - Task Plan Message Handler
  // Purpose: Applies task plan messages to the chat timeline (plan goal + steps).
  // Uses: applyTaskPlanMessage(), internal planMessageIdByCorrelation map
  // Used by: RuntimeEventsService (routes runtime messages)
  handleTaskPlanMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.plan') return

    const correlationId = msg.correlationId
    if (typeof correlationId !== 'string' || !correlationId.length) return

    const plan = msg.payload as any
    if (!plan || typeof plan.goal !== 'string' || !Array.isArray(plan.steps)) return

    this.messages = applyTaskPlanMessage({
      messages: this.messages,
      planMessageIdByCorrelation: this.planMessageIdByCorrelation,
      correlationId,
      plan,
      now: Date.now(),
    })
  }

  // CID:chat-state.service-004 - Task Step Message Handler
  // Purpose: Applies task step updates to the active plan in the chat timeline.
  // Uses: applyTaskStepMessage(), internal planMessageIdByCorrelation map
  // Used by: RuntimeEventsService (routes runtime messages)
  handleTaskStepMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.step') return

    const correlationId = msg.correlationId
    if (typeof correlationId !== 'string' || !correlationId.length) return

    const step = msg.payload as any
    const stepId = String(step?.stepId ?? '')
    const status = String(step?.status ?? '')
    if (!stepId.length) return

    this.messages = applyTaskStepMessage({
      messages: this.messages,
      planMessageIdByCorrelation: this.planMessageIdByCorrelation,
      correlationId,
      stepId,
      status,
    })
  }

  // CID:chat-state.service-005 - Task Result Handler
  // Purpose: Adds a final report message and clears active correlation tracking.
  // Uses: addSystemMessage(), clearActiveCorrelation()
  // Used by: RuntimeEventsService (routes runtime messages)
  handleTaskResultMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.result') return
    const payload = msg.payload as any
    const report = typeof payload?.report === 'string' ? payload.report.trim() : ''
    this.addSystemMessage(report.length ? report : 'Task completed.')

    this.clearActiveCorrelation(msg)
  }

  // CID:chat-state.service-006 - Task Error Handler
  // Purpose: Adds an error message and clears active correlation tracking.
  // Uses: addSystemMessage(), clearActiveCorrelation()
  // Used by: RuntimeEventsService (routes runtime messages)
  handleTaskErrorMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.error') return
    const err = msg.payload as any
    this.addSystemMessage(`Task error: ${String(err?.message ?? 'unknown')}`)

    this.clearActiveCorrelation(msg)
  }

  // CID:chat-state.service-007 - Task Stop Request
  // Purpose: Tracks whether a task is active and sends a stop request via runtime IPC.
  // Uses: RuntimeIpcService.sendTaskStop(), SessionService.profileId
  // Used by: Chat UI components (stop button)
  canStop(): boolean {
    return typeof this.activeCorrelationId === 'string' && this.activeCorrelationId.length > 0
  }

  stop(): void {
    if (!this.canStop()) return
    const correlationId = this.activeCorrelationId as string

    try {
      this.runtimeIpc.sendTaskStop(
        { correlationId },
        {
          profileId: this.session.profileId,
          correlationId,
        },
      )
      this.addSystemMessage('Stop requested. Waiting for current step to finish…')
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Runtime is not connected'
      this.addSystemMessage(`Could not stop task: ${reason}`)
    }
  }

  // CID:chat-state.service-008 - Toggle Plan Collapsed State
  // Purpose: Collapses/expands the plan UI for the specified message.
  // Uses: in-memory this.messages mapping
  // Used by: Chat UI components (plan toggle)
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

  // CID:chat-state.service-009 - Composer UI Handlers + Send
  // Purpose: Converts UI events (keydown/submit/file input) into send/attachment actions.
  // Uses: sendTaskFromDraft(), addAttachments()
  // Used by: Chat UI components (composer)
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
    if (!this.canSend()) return

    const res = sendTaskFromDraft({
      draft: this.draft,
      pendingAttachments: this.pendingAttachments,
      messages: this.messages,
      planMessageIdByCorrelation: this.planMessageIdByCorrelation,
      runtimeIpc: this.runtimeIpc,
      profileId: this.session.profileId,
    })

    this.draft = res.nextDraft
    this.pendingAttachments = res.nextPendingAttachments
    this.messages = res.nextMessages
    this.activeCorrelationId = res.nextActiveCorrelationId
  }

  // CID:chat-state.service-010 - Attachment Intake
  // Purpose: Converts selected files to attachment entries and emits a notice in chat.
  // Uses: buildAttachments(), attachmentNotice(), addSystemMessage()
  // Used by: onFileInputChange()
  private addAttachments(files: FileList | null): void {
    const next = buildAttachments(files)
    if (!next.length) return

    this.pendingAttachments = [...this.pendingAttachments, ...next]
    this.addSystemMessage(attachmentNotice(next.length), Date.now())
  }

  // CID:chat-state.service-011 - Correlation Cleanup
  // Purpose: Clears activeCorrelationId when a terminal task message (result/error) arrives.
  // Uses: msg.correlationId
  // Used by: handleTaskResultMessage(), handleTaskErrorMessage()
  private clearActiveCorrelation(msg: ActaMessage): void {
    if (typeof msg.correlationId === 'string' && this.activeCorrelationId === msg.correlationId) {
      this.activeCorrelationId = null
    }
  }
}
