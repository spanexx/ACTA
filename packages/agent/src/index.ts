// Agent package baseline (Phase-1)
export const AGENT_VERSION = "0.1.0"

export {
  buildTaskContextV1,
  type BuildTaskContextV1Options,
  type ContextMemoryEntry,
  type ContextToolInfo,
} from './context-builder'

export { buildDeterministicTaskReport } from './report'

import { buildDeterministicTaskReport } from './report'

import type { MemoryStore } from '@acta/memory'
import type { LLMRouter, LLMRequest, LLMResponse } from '@acta/llm'
import type { AgentPlan, AgentStep, RuntimeTask, ToolResult } from '@acta/ipc'
import type { LegacyToolRegistry } from '@acta/tools'
import type { TrustProfile, PermissionRequest, PermissionDecision, PermissionDecisionType } from '@acta/trust'
import type { Logger } from '@acta/logging'
import { canExecute } from '@acta/trust'

export interface MemoryManagerOptions {
  /** Maximum number of memory entries to retain. */
  maxEntries?: number
  /** Key prefix for agent-scoped memory. */
  prefix?: string
}

export type ActaAgentRunResult = {
  plan: AgentPlan
  success: boolean
  results: ToolResult[]
  report: string
}

export interface ActaAgentOptions {
  planner: Planner
  safetyGate: SafetyGate
  orchestrator: ExecutionOrchestrator
  availableTools: string[]
  emitEvent?: (type: string, payload: any) => void
  buildPlannerInput?: (task: RuntimeTask) => string
  onPlan?: (opts: { task: RuntimeTask; plan: AgentPlan }) => Promise<void> | void
  onResult?: (opts: { task: RuntimeTask; result: ActaAgentRunResult }) => Promise<void> | void
}

export class ActaAgent {
  private planner: Planner
  private safetyGate: SafetyGate
  private orchestrator: ExecutionOrchestrator
  private availableTools: string[]
  private emitEvent?: (type: string, payload: any) => void
  private buildPlannerInput?: (task: RuntimeTask) => string
  private onPlan?: (opts: { task: RuntimeTask; plan: AgentPlan }) => Promise<void> | void
  private onResult?: (opts: { task: RuntimeTask; result: ActaAgentRunResult }) => Promise<void> | void

  constructor(opts: ActaAgentOptions) {
    this.planner = opts.planner
    this.safetyGate = opts.safetyGate
    this.orchestrator = opts.orchestrator
    this.availableTools = opts.availableTools
    this.emitEvent = opts.emitEvent
    this.buildPlannerInput = opts.buildPlannerInput
    this.onPlan = opts.onPlan
    this.onResult = opts.onResult
  }

  async run(task: RuntimeTask): Promise<ActaAgentRunResult> {
    const plannerInput = this.buildPlannerInput ? this.buildPlannerInput(task) : task.input

    let plan: AgentPlan
    try {
      plan = await this.planner.plan(plannerInput, this.availableTools)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emitEvent?.('task.error', { taskId: task.taskId, code: 'task.plan_failed', message, details: message })
      throw err
    }

    await this.onPlan?.({ task, plan })

    try {
      this.safetyGate.validate(plan)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emitEvent?.('task.error', { taskId: task.taskId, code: 'task.safety_violation', message, details: message })
      throw err
    }

    const { success, results, report } = await this.orchestrator.execute(plan)

    const result: ActaAgentRunResult = { plan, success, results, report }
    await this.onResult?.({ task, result })
    return result
  }
}

export class MemoryManager {
  private store: MemoryStore
  private maxEntries: number
  private prefix: string

  constructor(store: MemoryStore, options?: MemoryManagerOptions) {
    this.store = store
    this.maxEntries = options?.maxEntries ?? 100
    this.prefix = options?.prefix ?? 'agent'
  }

  /**
   * Add a memory entry with optional TTL (seconds).
   * Enforces size limits by trimming oldest entries if needed.
   */
  async add<T = any>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = `${this.prefix}:${key}`
    await this.store.add(fullKey, value, ttlSeconds)
    await this.enforceLimit()
  }

  /** Retrieve a memory entry by key. */
  async get<T = any>(key: string): Promise<T | undefined> {
    const fullKey = `${this.prefix}:${key}`
    return this.store.get<T>(fullKey)
  }

  /** Delete a memory entry by key. */
  async delete(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`
    await this.store.delete(fullKey)
  }

  /** Clear all agent-scoped memory entries. */
  async clear(): Promise<void> {
    const entries = await this.store.list(this.prefix)
    for (const entry of entries) {
      await this.store.delete(entry.key)
    }
  }

  /** List all agent-scoped memory entries. */
  async list(): Promise<Array<{ key: string; value: any; timestamp: number }>> {
    const entries = await this.store.list(this.prefix)
    return entries.map(e => ({
      key: e.key.slice(this.prefix.length + 1),
      value: e.value,
      timestamp: e.timestamp,
    }))
  }

  /** Trim entries to enforce maxEntries limit (FIFO). */
  private async enforceLimit(): Promise<void> {
    const entries = await this.store.list(this.prefix)
    if (entries.length <= this.maxEntries) return

    const toDelete = entries.slice(0, entries.length - this.maxEntries)
    for (const entry of toDelete) {
      await this.store.delete(entry.key)
    }
  }
}

export interface PlannerOptions {
  /** System prompt for the planner. */
  systemPrompt?: string
  /** Tool IDs or prefixes that must never appear in plans. */
  blockedTools?: string[]
  /** Tool name substrings/prefixes treated as unsafe scopes (e.g. 'shell', 'system'). */
  blockedScopes?: string[]
}

export type PlannerToolInfo = {
  id: string
  description?: string
  allowedInputFields?: string[]
}

export type PlannerAvailableTool = string | PlannerToolInfo

/**
 * Planner generates an AgentPlan from user intent using an LLM.
 * Phase-1: stub prompt + basic JSON parsing/validation.
 */
export class Planner {
  private llm: LLMRouter
  private systemPrompt: string
  private blockedTools: Set<string>
  private blockedScopes: Set<string>

  constructor(llm: LLMRouter, options?: PlannerOptions) {
    this.llm = llm
    this.blockedTools = new Set(options?.blockedTools ?? [])
    this.blockedScopes = new Set(options?.blockedScopes ?? ['shell', 'system'])
    this.systemPrompt =
      options?.systemPrompt ??
      `You are Acta, a helpful AI assistant. Given a user request, generate a structured plan.
Return JSON with this schema:
{
  "goal": "brief goal description",
  "steps": [
    { "id": "step-1", "tool": "tool_id", "intent": "what this step does", "input": {}, "requiresPermission": true/false }
  ]
}
Only use known tool IDs.
Never use shell/system tools or any tool that looks like it can run arbitrary commands.`
  }

  /**
   * Generate a plan for the given user input.
   * Returns a validated AgentPlan.
   */
  async plan(input: string, availableTools: PlannerAvailableTool[]): Promise<AgentPlan> {
    const toolInfos: PlannerToolInfo[] = availableTools.map(t =>
      typeof t === 'string'
        ? { id: t }
        : {
            id: t.id,
            description: t.description,
            allowedInputFields: t.allowedInputFields,
          },
    )

    const toolIds = toolInfos.map(t => t.id)
    const toolsBlock = toolInfos
      .map(t => {
        const desc = typeof t.description === 'string' && t.description.trim().length ? ` — ${t.description}` : ''
        const fields =
          Array.isArray(t.allowedInputFields) && t.allowedInputFields.length
            ? ` (allowed input fields: ${t.allowedInputFields.join(', ')})`
            : ''
        return `- ${t.id}${desc}${fields}`
      })
      .join('\n')

    const prohibitions = `Prohibited tools/scopes:\n- shell.*\n- system.*\nRules:\n- Each step.input MUST be a JSON object ({}).\n- Do not include extra keys in input that are not necessary.`

    const prompt = `User request:\n${input}\n\nAvailable tools (id + description):\n${toolsBlock}\n\n${prohibitions}\n\nGenerate a plan as JSON.`

    const llmRequest: LLMRequest = {
      prompt,
      system: this.systemPrompt,
      maxTokens: 1000,
    }

    const response: LLMResponse = await this.llm.generate(llmRequest)

    const plan = this.parsePlan(response.text)
    this.validatePlan(plan, toolIds)
    return plan
  }

  private parsePlan(text: string): AgentPlan {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON plan from LLM response')
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0]
    const parsed = JSON.parse(jsonStr)

    if (!parsed.goal || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid plan structure: missing goal or steps')
    }

    return parsed as AgentPlan
  }

  private validatePlan(plan: AgentPlan, availableTools: string[]): void {
    if (!plan.goal || typeof plan.goal !== 'string') {
      throw new Error('Plan must have a non-empty goal')
    }

    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('Plan must have at least one step')
    }

    const stepIds = new Set<string>()
    for (const step of plan.steps) {
      if (!step.id || typeof step.id !== 'string') {
        throw new Error('Each step must have a non-empty id')
      }

      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`)
      }
      stepIds.add(step.id)

      if (!step.tool || typeof step.tool !== 'string') {
        throw new Error(`Step ${step.id} must have a tool`)
      }

      if (this.blockedTools.has(step.tool)) {
        throw new Error(`Step ${step.id} uses blocked tool: ${step.tool}`)
      }

      for (const scope of this.blockedScopes) {
        if (step.tool.startsWith(scope + '.') || step.tool.includes(scope)) {
          throw new Error(`Step ${step.id} uses unsafe scope: ${scope}`)
        }
      }

      if (!availableTools.includes(step.tool)) {
        throw new Error(`Step ${step.id} uses unknown tool: ${step.tool}`)
      }

      if (!step.input || typeof step.input !== 'object' || Array.isArray(step.input)) {
        throw new Error(`Step ${step.id} must include an input object`)
      }

      if (typeof step.requiresPermission !== 'boolean') {
        throw new Error(`Step ${step.id} requiresPermission must be boolean`)
      }
    }
  }
}

export interface SafetyGateOptions {
  /** Blocked tool IDs (hard deny). */
  blockedTools?: string[]
  /** Blocked scopes/patterns (e.g., 'shell', 'system'). */
  blockedScopes?: string[]
}

/**
 * Safety gate validates plans against blocked tools/scopes.
 * Phase-1: simple blocklist; can emit error via callback.
 */
export class SafetyGate {
  private blockedTools: Set<string>
  private blockedScopes: Set<string>

  constructor(options?: SafetyGateOptions) {
    this.blockedTools = new Set(options?.blockedTools ?? [])
    this.blockedScopes = new Set(options?.blockedScopes ?? [])
  }

  /**
   * Validate a plan. Throws if blocked tools/scopes are found.
   */
  validate(plan: AgentPlan): void {
    for (const step of plan.steps) {
      if (this.blockedTools.has(step.tool)) {
        throw new Error(`Safety gate: blocked tool '${step.tool}' in step '${step.id}'`)
      }

      for (const scope of this.blockedScopes) {
        if (step.tool.includes(scope) || step.intent.includes(scope)) {
          throw new Error(`Safety gate: blocked scope '${scope}' in step '${step.id}'`)
        }
      }
    }
  }
}

export interface ExecutionOrchestratorOptions {
  /** Profile ID for trust evaluation. */
  profileId: string
  /** Task id used to normalize task.error payloads. */
  taskId?: string
  /** Logger for audit and events. */
  logger: Logger
  /** Callback to emit IPC events. */
  emitEvent?: (type: string, payload: any) => void
  /** Optional cancellation check. If it returns true, execution halts before starting the next step (Phase-1). */
  isCancelled?: () => boolean
  /** Optional report summarizer (LLM-backed). Falls back to deterministic report if omitted/fails. */
  summarizeReport?: (opts: {
    plan: AgentPlan
    results: ToolResult[]
    defaultReport: string
  }) => Promise<string>
  /** Optional permission evaluator (e.g., TrustEngine backed by RuleStore). */
  evaluatePermission?: (request: PermissionRequest) => Promise<PermissionDecision>
  /** Callback to wait for UI permission response when required. */
  waitForPermission?: (request: PermissionRequest) => Promise<PermissionDecisionType>
}

/**
 * Executes an AgentPlan step-by-step with permission checks and IPC emissions.
 * Phase-1: stubbed permission response handling (always allow if not denied).
 */
export class ExecutionOrchestrator {
  private tools: LegacyToolRegistry
  private profile: TrustProfile
  private logger: Logger
  private emitEvent?: (type: string, payload: any) => void
  private isCancelled?: () => boolean
  private taskId?: string
  private evaluatePermission?: (request: PermissionRequest) => Promise<PermissionDecision>
  private waitForPermission?: (request: PermissionRequest) => Promise<PermissionDecisionType>
  private summarizeReport?: (opts: {
    plan: AgentPlan
    results: ToolResult[]
    defaultReport: string
  }) => Promise<string>

  constructor(
    tools: LegacyToolRegistry,
    profile: TrustProfile,
    options: ExecutionOrchestratorOptions,
  ) {
    this.tools = tools
    this.profile = profile
    this.logger = options.logger
    this.emitEvent = options.emitEvent
    this.isCancelled = options.isCancelled
    this.taskId = options.taskId
    this.evaluatePermission = options.evaluatePermission
    this.waitForPermission = options.waitForPermission
    this.summarizeReport = options.summarizeReport
  }

  /**
   * Execute all steps in the plan.
   * Emits task.plan, task.step (start/completed/error), and task.result.
   */
  async execute(plan: AgentPlan): Promise<{ success: boolean; results: ToolResult[]; report: string }> {
    this.emit('task.plan', plan)

    const results: ToolResult[] = []
    let cancelled = false

    for (let stepIndex = 0; stepIndex < plan.steps.length; stepIndex++) {
      if (this.isCancelled && this.isCancelled()) {
        cancelled = true
        break
      }

      const step = plan.steps[stepIndex]
      const startedAt = Date.now()
      this.emit('task.step', {
        stepIndex,
        stepId: step.id,
        tool: step.tool,
        intent: step.intent,
        input: step.input,
        status: 'in-progress',
        startedAt,
      })

      try {
        const permissionRequest = this.buildPermissionRequest(step)
        let decision = this.evaluatePermission
          ? await this.evaluatePermission(permissionRequest)
          : await canExecute(permissionRequest, this.profile, this.logger)

        if (decision.decision === 'ask' && this.waitForPermission) {
          this.emit('permission.request', permissionRequest)
          decision = {
            ...decision,
            decision: await this.waitForPermission(permissionRequest),
          }
        }

        if (decision.decision === 'deny') {
          const errorResult: ToolResult = {
            success: false,
            error: `Permission denied for tool '${step.tool}'`,
          }
          results.push(errorResult)

          const endedAt = Date.now()
          this.emit('task.step', {
            stepIndex,
            stepId: step.id,
            tool: step.tool,
            intent: step.intent,
            input: step.input,
            status: 'failed',
            endedAt,
            durationMs: endedAt - startedAt,
            failureReason: errorResult.error,
          })

          this.emit('task.error', {
            taskId: this.taskId ?? 'unknown',
            code: 'permission.denied',
            message: errorResult.error,
            stepId: step.id,
            details: errorResult.error,
          })

          this.logger.warn(`Step ${step.id} denied by trust engine`)
          break
        }

        const tool = await this.tools.get(step.tool)
        if (!tool) {
          const errorResult: ToolResult = {
            success: false,
            error: `Tool '${step.tool}' not found in registry`,
          }
          results.push(errorResult)

          const endedAt = Date.now()
          this.emit('task.step', {
            stepIndex,
            stepId: step.id,
            tool: step.tool,
            intent: step.intent,
            input: step.input,
            status: 'failed',
            endedAt,
            durationMs: endedAt - startedAt,
            failureReason: errorResult.error,
          })

          this.emit('task.error', {
            taskId: this.taskId ?? 'unknown',
            code: 'tool.not_found',
            message: errorResult.error,
            stepId: step.id,
            details: errorResult.error,
          })

          continue
        }

        const result = await tool.execute(step.input, {
          profileId: this.profile.profileId,
          cwd: process.cwd(),
          tempDir: process.cwd(),
          permissions: [],
        })

        results.push(result)
        const endedAt = Date.now()
        this.emit('task.step', {
          stepIndex,
          stepId: step.id,
          tool: step.tool,
          intent: step.intent,
          input: step.input,
          status: result.success ? 'completed' : 'failed',
          endedAt,
          durationMs: endedAt - startedAt,
          output: result.output,
          artifacts: result.artifacts,
          failureReason: result.error,
        })

        if (!result.success) {
          const msg = typeof result.error === 'string' && result.error.trim().length ? result.error : `Tool '${step.tool}' failed`
          this.emit('task.error', {
            taskId: this.taskId ?? 'unknown',
            code: 'tool.failed',
            message: msg,
            stepId: step.id,
            details: msg,
          })
        }
      } catch (err) {
        const errorResult: ToolResult = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
        results.push(errorResult)
        const endedAt = Date.now()
        this.emit('task.step', {
          stepIndex,
          stepId: step.id,
          tool: step.tool,
          intent: step.intent,
          input: step.input,
          status: 'failed',
          endedAt,
          durationMs: endedAt - startedAt,
          failureReason: errorResult.error,
        })

        this.emit('task.error', {
          taskId: this.taskId ?? 'unknown',
          code: 'tool.exception',
          message: errorResult.error,
          stepId: step.id,
          details: errorResult.error,
        })
      }
    }

    const completedAllSteps = results.length === plan.steps.length
    const success = !cancelled && completedAllSteps && results.every(r => r.success)

    // Phase-1: deterministic final report with optional LLM summarization.
    // Report is surfaced in the terminal task.result payload.
    let report = buildDeterministicTaskReport({ plan, results, goal: plan.goal })
    if (cancelled) {
      report = `Task cancelled by user.\n\n${report}`
    }
    if (this.summarizeReport) {
      try {
        const summarized = await this.summarizeReport({ plan, results, defaultReport: report })
        if (typeof summarized === 'string' && summarized.trim().length) {
          report = summarized
        }
      } catch {
      }
    }

    this.emit('task.result', {
      success,
      results,
      goal: plan.goal,
      report,
    })

    return { success, results, report }
  }

  private buildPermissionRequest(step: AgentStep): PermissionRequest {
    const tool = step.tool
    const input = step.input
    let scope = tool

    if (tool.startsWith('file.') && input && typeof input === 'object') {
      const maybePath = (input as any).path ?? (input as any).filePath ?? (input as any).src ?? (input as any).inputPath
      if (typeof maybePath === 'string' && maybePath.trim().length) scope = maybePath
    }

    return {
      id: `perm-${step.id}`,
      tool,
      action: step.intent,
      reason: `Execute step '${step.id}'`,
      scope,
      risk: step.requiresPermission ? 'medium' : 'low',
      reversible: true,
      timestamp: Date.now(),
      profileId: this.profile.profileId,
    }
  }

  private emit(type: string, payload: any): void {
    if (this.emitEvent) {
      this.emitEvent(type, payload)
    }
  }
}
