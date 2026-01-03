/*
 * Code Map: Task Context Building
 * - buildPlannerInput: Creates planner input from task context
 * 
 * CID Index:
 * CID:context-001 -> buildPlannerInput
 * 
 * Quick lookup: rg -n "CID:context-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/context.ts
 */

import { buildTaskContextV1 } from '@acta/agent'
import type { RuntimeTask } from '@acta/ipc'
import type { TrustProfile } from '@acta/trust'

// CID:context-001 - buildPlannerInput
// Purpose: Build structured planner input from task, tools, memory, and trust profile
// Uses: @acta/agent buildTaskContextV1, RuntimeTask, TrustProfile types
// Used by: ActaAgent in run-task-request.ts
export function buildPlannerInput(opts: {
  task: RuntimeTask
  toolList: Array<{ id: string; description?: string }>
  memoryEntries?: Array<{ key: string; value: any; timestamp: number }>
  profile: TrustProfile
}): string {
  return buildTaskContextV1({
    task: opts.task,
    tools: opts.toolList.map(t => ({ id: t.id, description: t.description })),
    memoryEntries: opts.memoryEntries?.map(e => ({ key: e.key, value: e.value, timestamp: e.timestamp })),
    trust: {
      trustLevel: opts.profile.defaultTrustLevel,
      profileId: opts.task.profileId,
    },
    llm: {
      providerId: 'mock-runtime',
    },
    limits: {
      maxChars: 6000,
      maxMemoryEntries: 10,
      maxToolEntries: 50,
      maxAttachmentEntries: 20,
    },
  })
}
