/*
 * Code Map: Execution Orchestrator
 * - ExecutionOrchestratorOptions: Configuration for orchestrator lifecycle
 * - ExecutionOrchestrator class: Drives step execution with trust & IPC hooks
 *   - execute: Run entire plan, handle permissions, emit events, build report
 *   - buildPermissionRequest: Derive permission request per step
 *   - emit: Helper to emit IPC events
 *
 * CID Index:
 * CID:execution-orch-001 -> ExecutionOrchestratorOptions
 * CID:execution-orch-002 -> ExecutionOrchestrator class
 * CID:execution-orch-003 -> execute method
 * CID:execution-orch-004 -> buildPermissionRequest
 * CID:execution-orch-005 -> emit helper
 *
 * Quick lookup: rg -n "CID:execution-orch-" /home/spanexx/Shared/Projects/ACTA/packages/agent/src/execution-orchestrator.ts
 */

import type { AgentPlan, AgentStep, ToolResult } from '@acta/ipc'
import type { LegacyToolRegistry } from '@acta/tools'
import type { TrustProfile, PermissionRequest, PermissionDecision, PermissionDecisionType } from '@acta/trust'
import type { Logger } from '@acta/logging'
import { canExecute } from '@acta/trust'

import { buildDeterministicTaskReport } from './report'

// CID:execution-orch-001 - ExecutionOrchestratorOptions
// Purpose: Capture orchestrator configuration hooks (logging, trust, permissions, report summary)
// Uses: Agent plan data, permission callbacks
// Used by: ExecutionOrchestrator constructor callers
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
// CID:execution-orch-002 - ExecutionOrchestrator class
// Purpose: Execute agent plans with trust checks, tool invocation, reporting, IPC events
// Uses: LegacyToolRegistry, Trust profile, permission hooks, deterministic report builder
// Used by: ActaAgent, runtime task execution
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
  // CID:execution-orch-003 - execute
  // Purpose: Iterate plan steps with cancellation, permission evaluation, tool execution, reporting
  // Uses: Permission hooks, tool registry, report builder, emit helper
  // Used by: ActaAgent.run to perform actual work
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
          const msg =
            typeof result.error === 'string' && result.error.trim().length ? result.error : `Tool '${step.tool}' failed`
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

  // CID:execution-orch-004 - buildPermissionRequest
  // Purpose: Construct permission request payload for a plan step (infers scope/path)
  // Uses: Step metadata, profile info
  // Used by: execute when evaluating permissions
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

  // CID:execution-orch-005 - emit helper
  // Purpose: Guarded event emission to external listeners
  // Uses: emitEvent callback
  // Used by: execute to publish IPC events
  private emit(type: string, payload: any): void {
    if (this.emitEvent) {
      this.emitEvent(type, payload)
    }
  }
}
