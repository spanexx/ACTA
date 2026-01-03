/*
 * Code Map: Agent Package Public API
 * - AGENT_VERSION constant
 * - Re-exports for context builder, report, ActaAgent, MemoryManager, Planner, SafetyGate, ExecutionOrchestrator
 *
 * CID Index:
 * CID:agent-index-001 -> AGENT_VERSION
 * CID:agent-index-002 -> context builder exports
 * CID:agent-index-003 -> report export
 * CID:agent-index-004 -> ActaAgent exports
 * CID:agent-index-005 -> MemoryManager exports
 * CID:agent-index-006 -> Planner exports
 * CID:agent-index-007 -> SafetyGate exports
 * CID:agent-index-008 -> ExecutionOrchestrator exports
 *
 * Quick lookup: rg -n "CID:agent-index-" /home/spanexx/Shared/Projects/ACTA/packages/agent/src/index.ts
 */

// CID:agent-index-001 - AGENT_VERSION
// Purpose: Surface agent package version
// Uses: Simple constant
// Used by: Consumers for compatibility checks
export const AGENT_VERSION = "0.1.0"

// CID:agent-index-002 - context builder exports
// Purpose: Re-export context builder utilities for planner input
// Uses: buildTaskContextV1 module
// Used by: Runtime and external packages
export {
  buildTaskContextV1,
  type BuildTaskContextV1Options,
  type ContextMemoryEntry,
  type ContextToolInfo,
} from './context-builder'

// CID:agent-index-003 - report export
// Purpose: Expose deterministic report builder
// Uses: report module
// Used by: Execution orchestrator internals and other consumers
export { buildDeterministicTaskReport } from './report'

// CID:agent-index-004 - ActaAgent exports
// Purpose: Export core agent class and option/result types
// Used by: Runtime task execution
export { ActaAgent, type ActaAgentOptions, type ActaAgentRunResult } from './acta-agent'

// CID:agent-index-005 - MemoryManager exports
// Purpose: Provide helper for managing agent memory stores
export { MemoryManager, type MemoryManagerOptions } from './memory-manager'

// CID:agent-index-006 - Planner exports
// Purpose: Re-export planner class and option types
export {
  Planner,
  type PlannerAvailableTool,
  type PlannerOptions,
  type PlannerToolInfo,
} from './planner'

// CID:agent-index-007 - SafetyGate exports
// Purpose: Re-export safety gate guard and options
export { SafetyGate, type SafetyGateOptions } from './safety-gate'

// CID:agent-index-008 - ExecutionOrchestrator exports
// Purpose: Re-export orchestrator and option type for tool execution
export { ExecutionOrchestrator, type ExecutionOrchestratorOptions } from './execution-orchestrator'
