/*
 * Code Map: Task Step → Tool Output Mapping
 * - upsertFromTaskStepMessage(): Converts task.step runtime messages into ToolOutputEntry timeline updates.
 * - Helpers: status mapping, progress clamping, input/output extraction.
 *
 * CID Index:
 * CID:tool-outputs-task-step-001 -> mapTaskStepStatus
 * CID:tool-outputs-task-step-002 -> clampProgress
 * CID:tool-outputs-task-step-003 -> extractInput
 * CID:tool-outputs-task-step-004 -> extractOutputPreview
 * CID:tool-outputs-task-step-005 -> upsertFromTaskStepMessage
 *
 * Lookup: rg -n "CID:tool-outputs-task-step-" apps/ui/src/app/state/tool-outputs-state/task-step.ts
 */

import type { ActaMessage } from '@acta/ipc'
import type { ToolOutputEntry } from '../../models/ui.models'

// CID:tool-outputs-task-step-001 - Map Task Step Status
// Purpose: Maps runtime step status strings to tool output statuses.
// Uses: task.step payload status conventions
// Used by: upsertFromTaskStepMessage()
function mapTaskStepStatus(status: string): 'running' | 'completed' | 'error' | null {
  return status === 'in-progress'
    ? 'running'
    : status === 'completed'
      ? 'completed'
      : status === 'failed'
        ? 'error'
        : status === 'start'
          ? 'running'
          : status === 'error'
            ? 'error'
            : null
}

// CID:tool-outputs-task-step-002 - Clamp Progress
// Purpose: Normalizes progress values into 0-100 integer percent.
// Uses: numeric progress (0..1 or 0..100)
// Used by: upsertFromTaskStepMessage()
function clampProgress(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined
  const pct = value <= 1 ? Math.round(value * 100) : Math.round(value)
  return Math.max(0, Math.min(100, pct))
}

// CID:tool-outputs-task-step-003 - Extract Input/Scope
// Purpose: Extracts best-effort input and scope strings from step input payloads.
// Uses: step.input payload shape heuristics
// Used by: upsertFromTaskStepMessage()
function extractInput(stepInput: any): { input?: string; scope?: string } {
  const input =
    typeof stepInput === 'string' ? stepInput : typeof stepInput?.text === 'string' ? stepInput.text : undefined

  const scope =
    typeof stepInput?.scope === 'string'
      ? stepInput.scope
      : typeof stepInput?.path === 'string'
        ? stepInput.path
        : typeof stepInput?.file === 'string'
          ? stepInput.file
          : undefined

  return { input, scope }
}

// CID:tool-outputs-task-step-004 - Extract Output Preview
// Purpose: Extracts a short preview string from step output payloads.
// Uses: step.output payload shape heuristics
// Used by: upsertFromTaskStepMessage()
function extractOutputPreview(stepOutput: any): string | undefined {
  return typeof stepOutput === 'string' ? stepOutput : typeof stepOutput?.summary === 'string' ? stepOutput.summary : undefined
}

// CID:tool-outputs-task-step-005 - Upsert From task.step Message
// Purpose: Creates/updates a ToolOutputEntry for a given task step and returns a timestamp-sorted list.
// Uses: ActaMessage.task.step payload; helpers above
// Used by: ToolOutputsStateService.handleTaskStepMessage(); RuntimeEventsService
export function upsertFromTaskStepMessage(toolOutputs: ToolOutputEntry[], msg: ActaMessage, now: number): ToolOutputEntry[] {
  if (msg.type !== 'task.step') return toolOutputs

  const correlationId = msg.correlationId
  if (typeof correlationId !== 'string' || !correlationId.length) return toolOutputs

  const step = msg.payload as any
  const stepId = String(step?.stepId ?? '')
  const status = String(step?.status ?? '')
  if (!stepId.length) return toolOutputs

  const mappedStatus = mapTaskStepStatus(status)
  if (!mappedStatus) return toolOutputs

  const tool = String(step?.tool ?? 'tool')
  const reason = typeof step?.intent === 'string' ? step.intent : undefined

  const stepInput = step?.input
  const { input, scope } = extractInput(stepInput)

  const progress = clampProgress(step?.progress)

  const outputPreview = extractOutputPreview(step?.output)

  const outputId = `${correlationId}:${stepId}`
  const existing = toolOutputs.find(o => o.id === outputId)

  const entry: ToolOutputEntry = {
    id: outputId,
    timestamp: now,
    tool,
    status: mappedStatus,
    scope,
    input,
    reason,
    progress,
    preview:
      mappedStatus === 'error'
        ? String(step?.failureReason ?? step?.error ?? 'error')
        : mappedStatus === 'completed'
          ? outputPreview
            ? `Completed: ${outputPreview}`
            : 'Completed'
          : 'Running',
    error: step?.failureReason ?? step?.error,
    raw: step,
    expanded: existing?.expanded ?? false,
    artifacts: Array.isArray(step?.artifacts) ? step.artifacts.map((p: any) => ({ path: String(p) })) : undefined,
  }

  return [...toolOutputs.filter(o => o.id !== outputId), entry].sort((a, b) => a.timestamp - b.timestamp)
}
