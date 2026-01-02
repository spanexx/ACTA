// Agent package baseline (Phase-1)
export const AGENT_VERSION = "0.1.0"

import type { MemoryStore } from '@acta/memory'
import type { LLMRouter, LLMRequest, LLMResponse } from '@acta/llm'
import type { AgentPlan, AgentStep, ToolResult } from '@acta/ipc'
import type { LegacyToolRegistry } from '@acta/tools'
import type { TrustProfile, PermissionRequest, PermissionDecisionType } from '@acta/trust'
import type { Logger } from '@acta/logging'
import { canExecute } from '@acta/trust'

export interface MemoryManagerOptions {
  /** Maximum number of memory entries to retain. */
  maxEntries?: number
  /** Key prefix for agent-scoped memory. */
  prefix?: string
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
}

/**
 * Planner generates an AgentPlan from user intent using an LLM.
 * Phase-1: stub prompt + basic JSON parsing/validation.
 */
export class Planner {
  private llm: LLMRouter
  private systemPrompt: string

  constructor(llm: LLMRouter, options?: PlannerOptions) {
    this.llm = llm
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
Only use known tool IDs.`
  }

  /**
   * Generate a plan for the given user input.
   * Returns a validated AgentPlan.
   */
  async plan(input: string, availableTools: string[]): Promise<AgentPlan> {
    const toolsList = availableTools.join(', ')
    const prompt = `User request: ${input}\nAvailable tools: ${toolsList}\nGenerate a plan as JSON.`

    const llmRequest: LLMRequest = {
      prompt,
      system: this.systemPrompt,
      maxTokens: 1000,
    }

    const response: LLMResponse = await this.llm.generate(llmRequest)

    const plan = this.parsePlan(response.text)
    this.validatePlan(plan, availableTools)
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

      if (!availableTools.includes(step.tool)) {
        throw new Error(`Step ${step.id} uses unknown tool: ${step.tool}`)
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
  /** Logger for audit and events. */
  logger: Logger
  /** Callback to emit IPC events. */
  emitEvent?: (type: string, payload: any) => void
  /** Callback to wait for UI permission response when required. */
  waitForPermission?: (request: PermissionRequest) => Promise<PermissionDecisionType>
}

/**
 * Executes an AgentPlan step-by-step with permission checks and IPC emissions.
 * Phase-1: stubbed permission response handling (always allow if not denied).
 */
export class ExecutionOrchestrator {
  private profile: TrustProfile
  private logger: Logger
  private emitEvent?: (type: string, payload: any) => void
  private waitForPermission?: (request: PermissionRequest) => Promise<PermissionDecisionType>

  constructor(
    private tools: LegacyToolRegistry,
    profile: TrustProfile,
    options: ExecutionOrchestratorOptions,
  ) {
    this.profile = profile
    this.logger = options.logger
    this.emitEvent = options.emitEvent
    this.waitForPermission = options.waitForPermission
  }

  /**
   * Execute all steps in the plan.
   * Emits task.plan, task.step (start/completed/error), and task.result.
   */
  async execute(plan: AgentPlan): Promise<{ success: boolean; results: ToolResult[] }> {
    this.emit('task.plan', plan)

    const results: ToolResult[] = []

    for (const step of plan.steps) {
      this.emit('task.step', {
        stepId: step.id,
        tool: step.tool,
        intent: step.intent,
        input: step.input,
        status: 'start',
      })

      try {
        const permissionRequest = this.buildPermissionRequest(step)
        let decision = await canExecute(permissionRequest, this.profile, this.logger)

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

          this.emit('task.step', {
            stepId: step.id,
            tool: step.tool,
            intent: step.intent,
            input: step.input,
            status: 'error',
            error: errorResult.error,
          })

          this.logger.warn(`Step ${step.id} denied by trust engine`)
          continue
        }

        const tool = await this.tools.get(step.tool)
        if (!tool) {
          const errorResult: ToolResult = {
            success: false,
            error: `Tool '${step.tool}' not found in registry`,
          }
          results.push(errorResult)

          this.emit('task.step', {
            stepId: step.id,
            tool: step.tool,
            intent: step.intent,
            input: step.input,
            status: 'error',
            error: errorResult.error,
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

        this.emit('task.step', {
          stepId: step.id,
          tool: step.tool,
          intent: step.intent,
          input: step.input,
          status: result.success ? 'completed' : 'error',
          output: result.output,
          error: result.error,
          artifacts: result.artifacts,
        })
      } catch (err) {
        const errorResult: ToolResult = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
        results.push(errorResult)

        this.emit('task.step', {
          stepId: step.id,
          tool: step.tool,
          intent: step.intent,
          input: step.input,
          status: 'error',
          error: errorResult.error,
        })
      }
    }

    const success = results.every(r => r.success)

    this.emit('task.result', {
      success,
      results,
      goal: plan.goal,
    })

    return { success, results }
  }

  private buildPermissionRequest(step: AgentStep): PermissionRequest {
    return {
      id: `perm-${step.id}`,
      tool: step.tool,
      action: step.intent,
      reason: `Execute step '${step.id}'`,
      scope: step.tool,
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
