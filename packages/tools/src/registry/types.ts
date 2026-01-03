/*
 * Code Map: Tool Registry Types
 * - AgentStep interface describing planner step metadata.
 * - ExecutionContext extending ToolContext with step/task identifiers.
 *
 * CID Index:
 * CID:tools-registry-types-001 -> AgentStep
 * CID:tools-registry-types-002 -> ExecutionContext
 *
 * Lookup: rg -n "CID:tools-registry-types-" packages/tools/src/registry/types.ts
 */

import type { ToolContext } from '@acta/core'

// CID:tools-registry-types-001 - AgentStep
// Purpose: Represents a single tool execution step produced by planner/orchestrator.
// Used by: ToolRegistry.execute(); loader pipelines
export interface AgentStep {
  id: string
  tool: string
  input: any
}

// CID:tools-registry-types-002 - ExecutionContext
// Purpose: Extends ToolContext with optional step/task identifiers for logging/audit.
// Uses: ToolContext from @acta/core
// Used by: ToolRegistry.execute(); audit logging helpers
export interface ExecutionContext extends ToolContext {
  stepId?: string
  taskId?: string
}
