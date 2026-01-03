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
import type { Attachment, ChatMessage, ChatMessageLane, ChatMessageType, ChatPlanStep, PlanStepStatus } from '../models/ui.models'
import { newId } from '../shared/ids'
import { SessionService } from './session.service'
import { buildAttachments, attachmentNotice } from './chat-state/attachments'
import { sendChatFromDraft, sendTaskFromDraft } from './chat-state/composer'
import { shouldAutoChat } from './chat-state/greeting-classifier'
import { makeMessage } from './chat-state/messages'
import { applyTaskPlanMessage, applyTaskStepMessage } from './chat-state/runtime-handlers'

// CID:chat-state.service-001 - Chat State Container
// Purpose: Owns chat UI state (draft/messages/attachments) and routes runtime task messages into UI updates.
// Uses: RuntimeIpcService, SessionService, chat-state helpers (attachments/composer/messages/runtime-handlers)
// Used by: Chat UI components; RuntimeEventsService routes messages here
@Injectable({ providedIn: 'root' })
export class ChatStateService {
  draft = ''
  mode: ChatMessageLane = 'task'
  pendingAttachments: Attachment[] = []
  messages: ChatMessage[] = []

  private planMessageIdByCorrelation = new Map<string, string>()
  private activeCorrelationId: string | null = null

  private storageProfileId = 'default'

  constructor(
    private runtimeIpc: RuntimeIpcService,
    private session: SessionService,
  ) {
    this.storageProfileId = this.session.profileId
    this.restore()

    this.session.profileId$.subscribe(profileId => {
      if (!profileId || profileId === this.storageProfileId) return
      this.persist()
      this.storageProfileId = profileId
      this.restore()
    })
  }

  private storageKey(): string {
    return `acta:ui:chat:${this.storageProfileId}`
  }

  persist(): void {
    try {
      globalThis.localStorage?.setItem(
        this.storageKey(),
        JSON.stringify({
          draft: this.draft,
          mode: this.mode,
          messages: this.messages,
          activeCorrelationId: this.activeCorrelationId,
        }),
      )
    } catch {
    }
  }

  private restore(): void {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey())
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        if (typeof (parsed as any).draft === 'string') this.draft = (parsed as any).draft
        if ((parsed as any).mode === 'task' || (parsed as any).mode === 'chat') this.mode = (parsed as any).mode
        if (Array.isArray((parsed as any).messages)) this.messages = (parsed as any).messages
        this.activeCorrelationId =
          typeof (parsed as any).activeCorrelationId === 'string' ? (parsed as any).activeCorrelationId : null
      }
    } catch {
    }
  }

  // CID:chat-state.service-002 - Append System Message
  // Purpose: Appends a system message to the message list.
  // Uses: makeMessage()
  // Used by: Many state services (setup/trust/profiles/demo/etc.) to surface status to the user
  addSystemMessage(text: string, timestamp = Date.now(), lane?: ChatMessageLane): void {
    this.messages = [...this.messages, makeMessage('system', text, timestamp, lane)]
    this.persist()
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
    this.persist()
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
    this.persist()
  }

  // CID:chat-state.service-005 - Task Result Handler
  // Purpose: Adds a final report message and clears active correlation tracking.
  // Uses: addSystemMessage(), clearActiveCorrelation()
  // Used by: RuntimeEventsService (routes runtime messages)
  handleTaskResultMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.result') return
    const payload = msg.payload as any
    const report = typeof payload?.report === 'string' ? payload.report.trim() : ''
    this.addSystemMessage(report.length ? report : 'Task completed.', Date.now(), 'task')

    this.clearActiveCorrelation(msg)
    this.persist()
  }

  // CID:chat-state.service-006 - Task Error Handler
  // Purpose: Adds an error message and clears active correlation tracking.
  // Uses: addSystemMessage(), clearActiveCorrelation()
  // Used by: RuntimeEventsService (routes runtime messages)
  handleTaskErrorMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.error') return
    const err = msg.payload as any
    const message =
      typeof err?.message === 'string'
        ? err.message
        : typeof err?.details === 'string'
          ? err.details
          : (() => {
              try {
                return JSON.stringify(err)
              } catch {
                return String(err)
              }
            })()

    this.addSystemMessage(`Task error: ${message}`, Date.now(), 'task')

    this.clearActiveCorrelation(msg)
    this.persist()
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
    this.persist()
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
    this.persist()
  }

  removePendingAttachment(id: string): void {
    this.pendingAttachments = this.pendingAttachments.filter(a => a.id !== id)
    this.persist()
  }

  canSend(): boolean {
    return this.draft.trim().length > 0 || this.pendingAttachments.length > 0
  }

  send(): void {
    if (!this.canSend()) return

    const autoChat = shouldAutoChat({
      mode: this.mode,
      draft: this.draft,
      pendingAttachmentsCount: this.pendingAttachments.length,
    })

    const lane: ChatMessageLane = this.mode === 'chat' || autoChat ? 'chat' : 'task'
    const reason = this.mode === 'chat' ? 'user-selected' : autoChat ? 'auto-greeting' : 'user-selected'
    const correlationId = newId()

    console.info('[UI Chat] send', {
      lane,
      reason,
      correlationId,
      profileId: this.session.profileId,
      hasAttachments: this.pendingAttachments.length > 0,
    })

    const res =
      lane === 'chat'
        ? sendChatFromDraft({
            draft: this.draft,
            pendingAttachments: this.pendingAttachments,
            messages: this.messages,
            runtimeIpc: this.runtimeIpc,
            profileId: this.session.profileId,
            correlationId,
          })
        : sendTaskFromDraft({
            draft: this.draft,
            pendingAttachments: this.pendingAttachments,
            messages: this.messages,
            planMessageIdByCorrelation: this.planMessageIdByCorrelation,
            runtimeIpc: this.runtimeIpc,
            profileId: this.session.profileId,
            correlationId,
          })

    this.draft = res.nextDraft
    this.pendingAttachments = res.nextPendingAttachments
    this.messages = res.nextMessages
    this.activeCorrelationId = res.nextActiveCorrelationId
    this.persist()
  }

  // CID:chat-state.service-010 - Attachment Intake
  // Purpose: Converts selected files to attachment entries and emits a notice in chat.
  // Uses: buildAttachments(), attachmentNotice(), addSystemMessage()
  // Used by: onFileInputChange()
  private addAttachments(files: FileList | null): void {
    const next = buildAttachments(files)
    if (!next.length) return

    this.pendingAttachments = [...this.pendingAttachments, ...next]
    this.addSystemMessage(attachmentNotice(next.length), Date.now(), this.mode)
    this.persist()
  }

  handleChatResponseMessage(msg: ActaMessage): void {
    if (msg.type !== 'chat.response') return

    console.info('[UI Chat] chat.response', {
      correlationId: msg.correlationId,
      replyTo: (msg as any).replyTo,
    })

    const payload = msg.payload as any
    const text = typeof payload?.text === 'string' ? payload.text : ''
    if (!text.trim().length) {
      this.addSystemMessage('Chat response received.', Date.now(), 'chat')
      return
    }

    const chatMsg: ChatMessage = {
      id: String(msg.id),
      type: 'acta',
      timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
      text,
      lane: 'chat',
    }
    this.messages = [...this.messages, chatMsg]
    this.persist()
  }

  handleChatErrorMessage(msg: ActaMessage): void {
    if (msg.type !== 'chat.error') return

    console.warn('[UI Chat] chat.error', {
      correlationId: msg.correlationId,
      replyTo: (msg as any).replyTo,
    })

    const payload = msg.payload as any
    const message = typeof payload?.message === 'string' ? payload.message : 'Unknown error'
    this.addSystemMessage(`Chat error: ${message}`, Date.now(), 'chat')
    this.persist()
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
