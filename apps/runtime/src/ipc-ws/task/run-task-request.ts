/*
 * Code Map: Task Request Execution
 * - runTaskRequest: Orchestrates complete task execution workflow
 * 
 * CID Index:
 * CID:run-task-001 -> runTaskRequest
 * 
 * Quick lookup: rg -n "CID:run-task-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/run-task-request.ts
 */

import { ActaAgent, ExecutionOrchestrator, Planner, SafetyGate } from '@acta/agent'
import { createLogger } from '@acta/logging'
import { LLMRouter } from '@acta/llm'
import { createMemoryStore } from '@acta/memory'
import { createDefaultRegistry } from '@acta/tools'
import type { RuntimeTask } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest, TrustProfile } from '@acta/trust'

import { RuntimeMockLLMAdapter } from '../mock-llm.adapter'
import { buildPlannerInput } from './context'
import { createTrustEvaluator } from './trust'
import { persistTranscriptOnError, persistTranscriptOnResult } from './transcript'

// CID:run-task-001 - runTaskRequest
// Purpose: Execute a complete task workflow with agent, tools, memory, and trust
// Uses: ActaAgent ecosystem, LLM router, memory store, trust evaluator, transcript persistence
// Used by: Task execution service in IPC WebSocket handler
export async function runTaskRequest(opts: {
  task: RuntimeTask
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  logsDir?: string
  memoryDir?: string
  trustDir?: string
  emitEvent: (type: string, payload: any) => void
  waitForPermission: (request: PermissionRequest) => Promise<PermissionDecisionType>
  isCancelled?: () => boolean
}): Promise<void> {
  const logger = createLogger('task-request', opts.logLevel, opts.logsDir ? { dir: opts.logsDir } : undefined)

  const tools = await createDefaultRegistry()
  const toolList = await tools.list()

  const llmRouter = new LLMRouter()
  llmRouter.register(new RuntimeMockLLMAdapter())

  const planner = new Planner(llmRouter)
  const safetyGate = new SafetyGate({ blockedTools: [], blockedScopes: [] })

  const profile: TrustProfile = { profileId: opts.task.profileId, defaultTrustLevel: 2 }

  const memoryEntries = opts.memoryDir ? await createMemoryStore({ dir: opts.memoryDir }).list() : undefined

  const evaluatePermission = await createTrustEvaluator({
    task: { correlationId: opts.task.correlationId, profileId: opts.task.profileId },
    logger,
    logsDir: opts.logsDir,
    trustDir: opts.trustDir,
    profile,
  })

  const orchestrator = new ExecutionOrchestrator(tools as any, profile, {
    profileId: opts.task.profileId,
    taskId: opts.task.taskId,
    logger,
    emitEvent: opts.emitEvent,
    isCancelled: opts.isCancelled,
    evaluatePermission,
    waitForPermission: opts.waitForPermission,
  })

  const agent = new ActaAgent({
    planner,
    safetyGate,
    orchestrator,
    availableTools: toolList.map(t => t.id),
    emitEvent: opts.emitEvent,
    buildPlannerInput: task =>
      buildPlannerInput({
        task,
        toolList: toolList.map(t => ({ id: t.id, description: t.description })),
        memoryEntries: memoryEntries?.map(e => ({ key: e.key, value: e.value, timestamp: e.timestamp })),
        profile,
      }),
    onResult: async ({ task, result }) => {
      await persistTranscriptOnResult({ memoryDir: opts.memoryDir, task, result })
    },
  })

  try {
    const result = await agent.run(opts.task)
    void result
  } catch (err) {
    if (opts.memoryDir) {
      await persistTranscriptOnError({ memoryDir: opts.memoryDir, task: opts.task, error: err })
    }
    throw err
  }
}
