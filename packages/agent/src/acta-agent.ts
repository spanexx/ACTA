/*
 * Code Map: Acta Agent Core
 * - ActaAgentRunResult type: Result payload returned by agent
 * - ActaAgentOptions interface: Construction options for agent
 * - ActaAgent class: Coordinates planning, safety gating, orchestration
 *   - run: Execute full plan lifecycle with safety and events
 *
 * CID Index:
 * CID:acta-agent-001 -> ActaAgentRunResult type
 * CID:acta-agent-002 -> ActaAgentOptions interface
 * CID:acta-agent-003 -> ActaAgent class
 * CID:acta-agent-004 -> run method
 *
 * Quick lookup: rg -n "CID:acta-agent-" /home/spanexx/Shared/Projects/ACTA/packages/agent/src/acta-agent.ts
 */

import type { AgentPlan, RuntimeTask, ToolResult } from '@acta/ipc'

import type { ExecutionOrchestrator } from './execution-orchestrator'
import type { Planner } from './planner'
import type { SafetyGate } from './safety-gate'

// CID:acta-agent-001 - ActaAgentRunResult type
// Purpose: Describe structured result returned after agent execution
// Uses: AgentPlan, ToolResult types
// Used by: ActaAgent run method consumers, transcript persistence
export type ActaAgentRunResult = {
  plan: AgentPlan
  success: boolean
  results: ToolResult[]
  report: string
}

// CID:acta-agent-002 - ActaAgentOptions interface
// Purpose: Capture dependencies/callbacks required to construct ActaAgent
// Uses: Planner, SafetyGate, ExecutionOrchestrator, runtime hooks
// Used by: Runtime task execution wiring
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

// CID:acta-agent-003 - ActaAgent class
// Purpose: Orchestrate planning, safety validation, tool execution, and callbacks
// Uses: Planner, SafetyGate, ExecutionOrchestrator, event emitters
// Used by: Runtime task execution entrypoint
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

  // CID:acta-agent-004 - run
  // Purpose: Execute full agent lifecycle (plan -> safety -> orchestrate -> callbacks)
  // Uses: Planner, SafetyGate, ExecutionOrchestrator, optional hooks
  // Used by: Runtime task runner to fulfill user tasks
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
