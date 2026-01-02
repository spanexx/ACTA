import type { ToolContext } from '@acta/core'

export interface AgentStep {
  id: string
  tool: string
  input: any
}

export interface ExecutionContext extends ToolContext {
  stepId?: string
  taskId?: string
}
