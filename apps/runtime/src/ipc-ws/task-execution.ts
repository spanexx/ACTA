import { ExecutionOrchestrator, Planner, SafetyGate } from '@acta/agent'
import { createLogger } from '@acta/logging'
import { LLMRouter } from '@acta/llm'
import { createDefaultRegistry } from '@acta/tools'
import type { PermissionDecisionType, PermissionRequest, TrustProfile } from '@acta/trust'
import { RuntimeMockLLMAdapter } from './mock-llm.adapter'

export async function runTaskRequest(opts: {
  input: string
  profileId: string
  correlationId: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  emitEvent: (type: string, payload: any) => void
  waitForPermission: (request: PermissionRequest) => Promise<PermissionDecisionType>
}): Promise<void> {
  const logger = createLogger('task-request', opts.logLevel)

  const tools = await createDefaultRegistry()
  const toolList = await tools.list()

  const llmRouter = new LLMRouter()
  llmRouter.register(new RuntimeMockLLMAdapter())

  const planner = new Planner(llmRouter)
  const safetyGate = new SafetyGate({ blockedTools: [], blockedScopes: [] })

  const plan = await planner.plan(opts.input, toolList.map(t => t.id))
  safetyGate.validate(plan)

  const profile: TrustProfile = { profileId: opts.profileId, defaultTrustLevel: 2 }
  const orchestrator = new ExecutionOrchestrator(tools as any, profile, {
    profileId: opts.profileId,
    logger,
    emitEvent: opts.emitEvent,
    waitForPermission: opts.waitForPermission,
  })

  await orchestrator.execute(plan)
}
