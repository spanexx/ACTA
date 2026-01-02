// IPC API types (Phase-1 skeleton)
// Aligns with Vision-Skeleton IPC API CONTRACT and Shared TypeScript Schemas

export interface ActaMessage<T = any> {
  id: string // uuid
  type: ActaMessageType
  source: 'ui' | 'agent' | 'tool' | 'system'
  timestamp: number
  payload: T
  profileId?: string
  correlationId?: string
  replyTo?: string
}

export type ActaMessageType =
  | 'task.request'
  | 'task.plan'
  | 'task.step'
  | 'task.permission'
  | 'permission.request'
  | 'permission.response'
  | 'task.result'
  | 'task.error'
  | 'memory.read'
  | 'memory.write'
  | 'trust.prompt'
  | 'system.event'

export interface TaskRequest {
  input: string
  context?: {
    files?: string[]
    screen?: boolean
    clipboard?: boolean
  }
  trustLevel?: 'low' | 'medium' | 'high'
}

export interface AgentPlan {
  goal: string
  steps: AgentStep[]
  risks?: string[]
}

export interface AgentStep {
  id: string
  tool: string
  intent: string
  input: any
  requiresPermission: boolean
}

export interface ToolResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: string[] // file paths
}

// Runtime-to-UI event payloads (examples for future use)
export interface TaskPlanPayload {
  goal: string
  steps: AgentStep[]
  risks?: string[]
}
export interface TaskStepPayload {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}
export interface TaskResultPayload {
  summary: string
  steps: number
  duration: number
}
export interface TaskErrorPayload {
  code: string
  message: string
  stepId?: string
}
export interface PermissionRequestPayload {
  tool: string
  action: string
  reason: string
  risks: string[]
  reversible: boolean
  rememberDecision?: boolean
}