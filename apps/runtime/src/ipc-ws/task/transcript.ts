/*
 * Code Map: Transcript Persistence
 * - persistTranscriptOnResult: Stores successful task execution transcripts
 * - persistTranscriptOnError: Stores failed task execution transcripts
 * 
 * CID Index:
 * CID:transcript-001 -> persistTranscriptOnResult
 * CID:transcript-002 -> persistTranscriptOnError
 * 
 * Quick lookup: rg -n "CID:transcript-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/transcript.ts
 */

import { createMemoryStore } from '@acta/memory'
import type { RuntimeTask } from '@acta/ipc'

import type { ActaAgentRunResult } from '@acta/agent'

import { clampString, summarizeToolResult } from './utils'

// CID:transcript-001 - persistTranscriptOnResult
// Purpose: Persist structured transcript of successful task execution to memory store
// Uses: Memory store, clampString, summarizeToolResult utilities
// Used by: ActaAgent onResult callback in run-task-request.ts
export async function persistTranscriptOnResult(opts: {
  memoryDir?: string
  task: RuntimeTask
  result: ActaAgentRunResult
}): Promise<void> {
  if (!opts.memoryDir) return

  try {
    const store = createMemoryStore({ dir: opts.memoryDir })

    const maxInputChars = 2000
    const maxReportChars = 4000
    const maxToolResultChars = 800

    const transcript = {
      taskId: opts.task.taskId,
      correlationId: opts.task.correlationId,
      profileId: opts.task.profileId,
      ok: opts.result.success,
      timestamp: Date.now(),
      input: clampString(opts.task.input ?? '', maxInputChars),
      plan: {
        goal: clampString(opts.result.plan?.goal ?? '', 400),
        steps: Array.isArray(opts.result.plan?.steps)
          ? opts.result.plan.steps.slice(0, 50).map(s => ({
              id: s.id,
              tool: s.tool,
              intent: clampString(s.intent ?? '', 200),
            }))
          : [],
      },
      toolOutputs: Array.isArray(opts.result.results)
        ? opts.result.results.slice(0, 50).map(r => summarizeToolResult(r, maxToolResultChars))
        : [],
      report: clampString(opts.result.report ?? '', maxReportChars),
    }

    await store.add(`task:${opts.task.correlationId}:transcript`, transcript)
    await store.add(`task:${opts.task.correlationId}:lastRun`, {
      ok: opts.result.success,
      profileId: opts.task.profileId,
      timestamp: Date.now(),
    })
  } catch {
  }
}

// CID:transcript-002 - persistTranscriptOnError
// Purpose: Persist error transcript of failed task execution to memory store
// Uses: Memory store, clampString utility
// Used by: Error handling in run-task-request.ts
export async function persistTranscriptOnError(opts: {
  memoryDir?: string
  task: RuntimeTask
  error: unknown
}): Promise<void> {
  if (!opts.memoryDir) return

  try {
    const store = createMemoryStore({ dir: opts.memoryDir })
    const message = opts.error instanceof Error ? opts.error.message : String(opts.error)

    await store.add(`task:${opts.task.correlationId}:transcript`, {
      taskId: opts.task.taskId,
      correlationId: opts.task.correlationId,
      profileId: opts.task.profileId,
      ok: false,
      timestamp: Date.now(),
      input: clampString(opts.task.input ?? '', 2000),
      error: clampString(message, 2000),
    })

    await store.add(`task:${opts.task.correlationId}:lastRun`, {
      ok: false,
      profileId: opts.task.profileId,
      timestamp: Date.now(),
    })
  } catch {
  }
}
