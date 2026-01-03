/**
 * Code Map: Chat Message Composer
 * - Provides sendTaskFromDraft function for processing user input and sending tasks
 * 
 * CID Index:
 * CID:composer-001 -> sendTaskFromDraft function
 * 
 * Quick lookup: grep -n "CID:composer-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/chat-state/composer.ts
 */

import type { RuntimeIpcService } from '../../runtime-ipc.service'
import type { Attachment, ChatMessage } from '../../models/ui.models'
import { newId } from '../../shared/ids'
import { makeMessage } from './messages'

/**
 * CID:composer-001 - sendTaskFromDraft Function
 * Purpose: Processes user draft input and sends task requests to runtime
 * Uses: RuntimeIpcService, newId, makeMessage, ChatMessage types
 * Used by: ChatStateService for handling user message submissions
 */
export function sendTaskFromDraft(opts: {
  draft: string
  pendingAttachments: Attachment[]
  messages: ChatMessage[]
  planMessageIdByCorrelation: Map<string, string>
  runtimeIpc: RuntimeIpcService
  profileId: string
  correlationId?: string
}): {
  nextDraft: string
  nextPendingAttachments: Attachment[]
  nextMessages: ChatMessage[]
  nextActiveCorrelationId: string | null
} {
  const text = opts.draft.trim()
  const attachments = opts.pendingAttachments.length ? [...opts.pendingAttachments] : undefined

  if (!text && !attachments) {
    return {
      nextDraft: opts.draft,
      nextPendingAttachments: opts.pendingAttachments,
      nextMessages: opts.messages,
      nextActiveCorrelationId: null,
    }
  }

  const now = Date.now()
  const taskId = opts.correlationId ?? newId()

  const userMsg: ChatMessage = {
    id: newId(),
    type: 'user',
    timestamp: now,
    text: text || 'Sent attachments.',
    attachments,
    lane: 'task',
  }

  try {
    const files = attachments
      ? attachments
          .map(a => a.path)
          .filter((p): p is string => typeof p === 'string' && p.length > 0)
      : undefined

    opts.runtimeIpc.sendTaskRequest(
      {
        input: text || 'Sent attachments.',
        context: files && files.length ? { files } : undefined,
      },
      {
        profileId: opts.profileId,
        correlationId: taskId,
      },
    )

    const planPlaceholderId = newId()
    opts.planMessageIdByCorrelation.set(taskId, planPlaceholderId)

    const pendingMsg: ChatMessage = {
      id: newId(),
      type: 'system',
      timestamp: now + 1,
      text: 'Task sent to runtime. Waiting for plan…',
      lane: 'task',
    }

    const planPlaceholder: ChatMessage = {
      id: planPlaceholderId,
      type: 'acta',
      timestamp: now + 2,
      text: 'Planning…',
      lane: 'task',
      plan: {
        goal: 'Planning…',
        collapsed: false,
        steps: [],
      },
    }

    return {
      nextDraft: '',
      nextPendingAttachments: [],
      nextMessages: [...opts.messages, userMsg, pendingMsg, planPlaceholder],
      nextActiveCorrelationId: taskId,
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Runtime is not connected'
    const errorMsg = makeMessage(
      'system',
      `Could not send task: ${reason}. Please check the runtime and try again.`,
      now + 1,
    )

    return {
      nextDraft: opts.draft,
      nextPendingAttachments: opts.pendingAttachments,
      nextMessages: [...opts.messages, userMsg, { ...errorMsg, lane: 'task' }],
      nextActiveCorrelationId: taskId,
    }
  }
}

export function sendChatFromDraft(opts: {
  draft: string
  pendingAttachments: Attachment[]
  messages: ChatMessage[]
  runtimeIpc: RuntimeIpcService
  profileId: string
  correlationId?: string
}): {
  nextDraft: string
  nextPendingAttachments: Attachment[]
  nextMessages: ChatMessage[]
  nextActiveCorrelationId: string | null
} {
  const text = opts.draft.trim()
  const attachments = opts.pendingAttachments.length ? [...opts.pendingAttachments] : undefined

  if (!text && !attachments) {
    return {
      nextDraft: opts.draft,
      nextPendingAttachments: opts.pendingAttachments,
      nextMessages: opts.messages,
      nextActiveCorrelationId: null,
    }
  }

  const now = Date.now()
  const chatId = opts.correlationId ?? newId()

  const userMsg: ChatMessage = {
    id: newId(),
    type: 'user',
    timestamp: now,
    text: text || 'Sent attachments.',
    attachments,
    lane: 'chat',
  }

  try {
    const files = attachments
      ? attachments
          .map(a => a.path)
          .filter((p): p is string => typeof p === 'string' && p.length > 0)
      : undefined

    opts.runtimeIpc.sendChatRequest(
      {
        input: text || 'Sent attachments.',
        context: files && files.length ? { files } : undefined,
      },
      {
        profileId: opts.profileId,
        correlationId: chatId,
      },
    )

    const pendingMsg: ChatMessage = {
      id: newId(),
      type: 'system',
      timestamp: now + 1,
      text: 'Chat sent to runtime. Waiting for response…',
      lane: 'chat',
    }

    return {
      nextDraft: '',
      nextPendingAttachments: [],
      nextMessages: [...opts.messages, userMsg, pendingMsg],
      nextActiveCorrelationId: null,
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Runtime is not connected'
    const errorMsg = makeMessage(
      'system',
      `Could not send chat: ${reason}. Please check the runtime and try again.`,
      now + 1,
    )

    return {
      nextDraft: opts.draft,
      nextPendingAttachments: opts.pendingAttachments,
      nextMessages: [...opts.messages, userMsg, { ...errorMsg, lane: 'chat' }],
      nextActiveCorrelationId: null,
    }
  }
}
