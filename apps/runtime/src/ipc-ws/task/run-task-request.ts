/*
 * Code Map: Task Request Execution
 * - runTaskRequest: Orchestrates complete task execution workflow
 * 
 * CID Index:
 * CID:run-task-001 -> runTaskRequest
 * 
 * Quick lookup: rg -n "CID:run-task-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/run-task-request.ts
 */

import { createLogger } from '@acta/logging'
import { createDefaultRegistry } from '@acta/tools'
import type { RuntimeTask } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

import type { Profile } from '@acta/profiles'

import { createTaskAgent } from './agent-factory'
import { createTaskLLMRouter } from './llm-router'
import { createPlanningLLM } from './planning-llm'
import { buildTrustProfile } from './trust-profile'
import { createTrustEvaluator } from './trust'
import { persistTranscriptOnError } from './transcript'

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
  profileService: { getProfile: (profileId?: string) => Promise<Profile> }
  emitEvent: (type: string, payload: any) => void
  waitForPermission: (request: PermissionRequest) => Promise<PermissionDecisionType>
  isCancelled?: () => boolean
}): Promise<void> {
  const logger = createLogger('task-request', opts.logLevel, opts.logsDir ? { dir: opts.logsDir } : undefined)

  const tools = await createDefaultRegistry()
  const toolList = await tools.list()

  const profileDoc = await opts.profileService.getProfile(opts.task.profileId)

  const profile = buildTrustProfile(opts.task, profileDoc)

  const llmRouter = createTaskLLMRouter(profileDoc)

  const evaluatePermission = await createTrustEvaluator({
    task: { correlationId: opts.task.correlationId, profileId: opts.task.profileId },
    logger,
    logsDir: opts.logsDir,
    trustDir: opts.trustDir,
    profile,
  })

  const planningLLM = createPlanningLLM({
    llmRouter,
    profileDoc,
    task: { taskId: opts.task.taskId, correlationId: opts.task.correlationId, profileId: opts.task.profileId },
    logger,
    profile,
    emitEvent: opts.emitEvent,
    waitForPermission: opts.waitForPermission,
    evaluatePermission,
  })

  const agent = await createTaskAgent({
    task: opts.task,
    profile,
    logger,
    tools,
    toolList,
    planningLLM,
    memoryDir: opts.memoryDir,
    emitEvent: opts.emitEvent,
    isCancelled: opts.isCancelled,
    evaluatePermission,
    waitForPermission: opts.waitForPermission,
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
