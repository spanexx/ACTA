/*
 * Code Map: Task Agent Factory
 * - createTaskAgent: Build planner, safety gate, orchestrator, and ActaAgent instance for a task.
 *
 * CID Index:
 * CID:agent-factory-001 -> createTaskAgent
 *
 * Quick lookup: rg -n "CID:agent-factory-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/agent-factory.ts
 */

import { ActaAgent, ExecutionOrchestrator, Planner, SafetyGate } from '@acta/agent'
import { createMemoryStore } from '@acta/memory'
import type { Logger } from '@acta/logging'
import type { RuntimeTask } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest, TrustProfile } from '@acta/trust'
import type { LegacyToolRegistry } from '@acta/tools'

import { buildPlannerInput } from './context'
import { persistTranscriptOnResult } from './transcript'

// CID:agent-factory-001 - createTaskAgent
// Purpose: Centralize ActaAgent construction and its dependencies (planner/safety/orchestrator/memory).
// Uses: Planner, SafetyGate, ExecutionOrchestrator, createMemoryStore, buildPlannerInput.
// Used by: runTaskRequest to produce an agent ready to execute the task.
export async function createTaskAgent(opts: {
  task: RuntimeTask
  profile: TrustProfile
  logger: Logger
  tools: LegacyToolRegistry
  toolList: Array<{ id: string; description?: string }>
  planningLLM: any
  memoryDir?: string
  emitEvent: (type: string, payload: any) => void
  isCancelled?: () => boolean
  evaluatePermission?: (request: PermissionRequest) => Promise<any>
  waitForPermission: (request: PermissionRequest) => Promise<PermissionDecisionType>
}): Promise<ActaAgent> {
  const planner = new Planner(opts.planningLLM)
  const safetyGate = new SafetyGate({ blockedTools: [], blockedScopes: [] })

  const memoryEntries = opts.memoryDir ? await createMemoryStore({ dir: opts.memoryDir }).list() : undefined

  const orchestrator = new ExecutionOrchestrator(opts.tools as any, opts.profile, {
    profileId: opts.task.profileId,
    taskId: opts.task.taskId,
    logger: opts.logger,
    emitEvent: opts.emitEvent,
    isCancelled: opts.isCancelled,
    evaluatePermission: opts.evaluatePermission,
    waitForPermission: opts.waitForPermission,
  })

  return new ActaAgent({
    planner,
    safetyGate,
    orchestrator,
    availableTools: opts.toolList.map(t => t.id),
    emitEvent: opts.emitEvent,
    buildPlannerInput: task =>
      buildPlannerInput({
        task,
        toolList: opts.toolList.map(t => ({ id: t.id, description: t.description })),
        memoryEntries: memoryEntries?.map(e => ({ key: e.key, value: e.value, timestamp: e.timestamp })),
        profile: opts.profile,
      }),
    onResult: async ({ task, result }) => {
      await persistTranscriptOnResult({ memoryDir: opts.memoryDir, task, result })
    },
  })
}
