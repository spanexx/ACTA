import { ActaAgent, buildTaskContextV1, ExecutionOrchestrator, Planner, SafetyGate } from '@acta/agent'
import { createLogger } from '@acta/logging'
import { LLMRouter } from '@acta/llm'
import { createMemoryStore } from '@acta/memory'
import { createDefaultRegistry } from '@acta/tools'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { RuntimeTask } from '@acta/ipc'
import { RuleStore, TrustEngine, type PermissionDecision, type PermissionDecisionType, type PermissionRequest, type TrustProfile } from '@acta/trust'
import { RuntimeMockLLMAdapter } from './mock-llm.adapter'

function safeStringify(value: any): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function clampString(value: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (value.length <= maxChars) return value
  return value.slice(0, maxChars)
}

function summarizeToolResult(result: any, maxChars: number): any {
  if (!result || typeof result !== 'object') return { success: false, error: 'invalid tool result' }

  const output = (result as any).output
  const error = (result as any).error
  const artifacts = Array.isArray((result as any).artifacts) ? (result as any).artifacts : undefined

  const out: any = {
    success: Boolean((result as any).success),
  }

  if (typeof error === 'string' && error.length) {
    out.error = clampString(error, maxChars)
  }

  if (output !== undefined) {
    out.output = clampString(safeStringify(output), maxChars)
  }

  if (artifacts && artifacts.length) {
    out.artifacts = artifacts.slice(0, 20)
  }

  return out
}

async function appendAuditLog(opts: { logsDir?: string; event: any }): Promise<void> {
  if (!opts.logsDir) return
  try {
    const filePath = path.join(opts.logsDir, 'audit.log')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, JSON.stringify(opts.event) + '\n', 'utf8')
  } catch {
    return
  }
}

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

  let evaluatePermission: ((request: PermissionRequest) => Promise<PermissionDecision>) | undefined = undefined
  if (opts.trustDir) {
    const store = new RuleStore({ profileTrustDir: opts.trustDir })
    const engine = new TrustEngine({ ruleStore: store })
    evaluatePermission = async (request: PermissionRequest) => {
      const decision = await engine.canExecute(request, profile, logger)
      await appendAuditLog({
        logsDir: opts.logsDir,
        event: {
          type: 'permission.evaluate',
          timestamp: Date.now(),
          correlationId: opts.task.correlationId,
          profileId: opts.task.profileId,
          requestId: request.id,
          tool: request.tool,
          scope: request.scope,
          action: request.action,
          decision: decision.decision,
          source: decision.source,
          reason: decision.reason,
        },
      })
      return decision
    }
  }

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
    buildPlannerInput: task => {
      return buildTaskContextV1({
        task,
        tools: toolList.map(t => ({ id: t.id, description: t.description })),
        memoryEntries: memoryEntries?.map(e => ({ key: e.key, value: e.value, timestamp: e.timestamp })),
        trust: {
          trustLevel: profile.defaultTrustLevel,
          profileId: task.profileId,
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
    },
    onResult: async ({ task, result }) => {
      if (!opts.memoryDir) return
      try {
        const store = createMemoryStore({ dir: opts.memoryDir })

        const maxInputChars = 2000
        const maxReportChars = 4000
        const maxToolResultChars = 800

        const transcript = {
          taskId: task.taskId,
          correlationId: task.correlationId,
          profileId: task.profileId,
          ok: result.success,
          timestamp: Date.now(),
          input: clampString(task.input ?? '', maxInputChars),
          plan: {
            goal: clampString(result.plan?.goal ?? '', 400),
            steps: Array.isArray(result.plan?.steps)
              ? result.plan.steps.slice(0, 50).map(s => ({
                  id: s.id,
                  tool: s.tool,
                  intent: clampString(s.intent ?? '', 200),
                }))
              : [],
          },
          toolOutputs: Array.isArray(result.results)
            ? result.results.slice(0, 50).map(r => summarizeToolResult(r, maxToolResultChars))
            : [],
          report: clampString(result.report ?? '', maxReportChars),
        }

        await store.add(`task:${task.correlationId}:transcript`, transcript)
        await store.add(`task:${task.correlationId}:lastRun`, {
          ok: result.success,
          profileId: task.profileId,
          timestamp: Date.now(),
        })
      } catch {
      }
    },
  })

  try {
    const result = await agent.run(opts.task)
    void result
  } catch (err) {
    if (!opts.memoryDir) throw err
    try {
      const store = createMemoryStore({ dir: opts.memoryDir })
      const message = err instanceof Error ? err.message : String(err)
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
    throw err
  }
}
