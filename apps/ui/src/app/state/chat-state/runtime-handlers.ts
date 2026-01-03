/**
 * Code Map: Runtime Message Handlers
 * - Provides applyTaskPlanMessage for handling task plan updates
 * - Provides mapTaskStepStatus for mapping runtime step statuses
 * - Provides applyTaskStepMessage for handling individual step updates
 * 
 * CID Index:
 * CID:runtime-handlers-001 -> applyTaskPlanMessage function
 * CID:runtime-handlers-002 -> mapTaskStepStatus function
 * CID:runtime-handlers-003 -> applyTaskStepMessage function
 * 
 * Lookup: rg -n "CID:runtime-handlers-" apps/ui/src/app/state/chat-state/runtime-handlers.ts
 */

import type { ChatMessage, ChatPlanStep, PlanStepStatus } from '../../models/ui.models'
import { newId } from '../../shared/ids'

/**
 * CID:runtime-handlers-001 - applyTaskPlanMessage Function
 * Purpose: Applies task plan updates to chat messages, creates or updates plan placeholder
 * Uses: ChatMessage, ChatPlanStep types, newId from shared ids
 * Used by: ChatStateService for handling task.plan messages from runtime
 */
export function applyTaskPlanMessage(opts: {
  messages: ChatMessage[]
  planMessageIdByCorrelation: Map<string, string>
  correlationId: string
  plan: { goal: string; steps: any[] }
  now: number
}): ChatMessage[] {
  const mappedSteps: ChatPlanStep[] = opts.plan.steps.map((s: any) => ({
    id: String(s?.id ?? newId()),
    title: String(s?.intent ?? s?.tool ?? 'step'),
    status: 'pending',
  }))

  const existingId = opts.planMessageIdByCorrelation.get(opts.correlationId)
  if (existingId) {
    return opts.messages.map(m => {
      if (m.id !== existingId) return m
      return {
        ...m,
        text: `I can do that. Here's the plan:`,
        lane: 'task',
        plan: {
          goal: opts.plan.goal,
          collapsed: false,
          steps: mappedSteps,
        },
      }
    })
  }

  const planMsg: ChatMessage = {
    id: newId(),
    type: 'acta',
    timestamp: opts.now,
    text: `I can do that. Here's the plan:`,
    lane: 'task',
    plan: {
      goal: opts.plan.goal,
      collapsed: false,
      steps: mappedSteps,
    },
  }

  opts.planMessageIdByCorrelation.set(opts.correlationId, planMsg.id)
  return [...opts.messages, planMsg]
}

/**
 * CID:runtime-handlers-002 - mapTaskStepStatus Function
 * Purpose: Maps runtime step status strings to UI PlanStepStatus enum
 * Uses: PlanStepStatus type from ui.models
 * Used by: applyTaskStepMessage for status normalization
 */
export function mapTaskStepStatus(status: string): PlanStepStatus | null {
  return status === 'in-progress'
    ? 'in-progress'
    : status === 'completed'
      ? 'completed'
      : status === 'failed'
        ? 'failed'
        : status === 'start'
          ? 'in-progress'
          : status === 'error'
            ? 'failed'
            : null
}

/**
 * CID:runtime-handlers-003 - applyTaskStepMessage Function
 * Purpose: Updates individual step status within existing plan message
 * Uses: ChatMessage, PlanStepStatus types, mapTaskStepStatus helper
 * Used by: ChatStateService for handling task.step messages from runtime
 */
export function applyTaskStepMessage(opts: {
  messages: ChatMessage[]
  planMessageIdByCorrelation: Map<string, string>
  correlationId: string
  stepId: string
  status: string
}): ChatMessage[] {
  const planMessageId = opts.planMessageIdByCorrelation.get(opts.correlationId)
  if (!planMessageId) return opts.messages

  const mappedStatus = mapTaskStepStatus(opts.status)
  if (!mappedStatus) return opts.messages

  return opts.messages.map(m => {
    if (m.id !== planMessageId) return m
    if (!m.plan) return m
    return {
      ...m,
      plan: {
        ...m.plan,
        steps: m.plan.steps.map(s => (s.id === opts.stepId ? { ...s, status: mappedStatus } : s)),
      },
    }
  })
}
