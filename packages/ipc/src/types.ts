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
  | 'task.stop'
  | 'task.plan'
  | 'task.step'
  | 'task.permission'
  | 'permission.request'
  | 'permission.response'
  | 'profile.list'
  | 'profile.create'
  | 'profile.delete'
  | 'profile.switch'
  | 'profile.active'
  | 'profile.get'
  | 'profile.update'
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

export interface TaskStopRequest {
  correlationId?: string
}

export interface RuntimeTask {
  taskId: string
  correlationId: string
  profileId: string
  input: string
  attachments?: string[]
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
  stepIndex?: number
  status: 'in-progress' | 'completed' | 'failed'
  startedAt?: number
  endedAt?: number
  durationMs?: number
  artifacts?: string[]
  failureReason?: string
}
export interface TaskResultPayload {
  success: boolean
  goal?: string
  report: string
  results?: ToolResult[]
}
export interface TaskErrorPayload {
  taskId: string
  code: string
  message: string
  stepId?: string
  details?: string
}
export interface PermissionRequestPayload {
  id: string
  tool: string
  domain?: string
  action: string
  reason: string
  scope?: string
  risk?: string
  risks?: string[]
  reversible: boolean
  timestamp?: number
  profileId?: string
  trustLevel?: number
  rememberDecision?: boolean
  cloud?: {
    provider: string
    model?: string
    warning?: string
  }
}

export interface PermissionResponsePayload {
  requestId: string
  decision: 'allow' | 'deny'
  remember?: boolean
}

export interface ProfileSummary {
  id: string
  name: string
  active: boolean
}

export interface ProfileListPayload {
  profiles: ProfileSummary[]
}

export interface ProfileCreateRequest {
  name: string
  profileId?: string
}

export interface ProfileCreatePayload {
  profile: ProfileSummary
}

export interface ProfileDeleteRequest {
  profileId: string
  deleteFiles?: boolean
}

export interface ProfileDeletePayload {
  deleted: true
  profileId: string
}

export interface ProfileSwitchRequest {
  profileId: string
}

export interface ProfileSwitchPayload {
  profile: ProfileSummary
}

export interface ProfileActivePayload {
  profile: ProfileSummary | null
}

export interface ProfileGetRequest {
  profileId?: string
}

export interface ProfileDoc {
  id: string
  name: string
  setupComplete: boolean
  trust: {
    defaultTrustLevel: number
    tools?: Record<string, number>
    domains?: Record<string, number>
  }
  llm: {
    mode: 'local' | 'cloud'
    adapterId: string
    model: string
    endpoint?: string
    cloudWarnBeforeSending?: boolean
  }
}

export interface ProfileGetPayload {
  profile: ProfileDoc
}

export interface ProfileUpdateRequest {
  profileId: string
  patch: {
    name?: string
    setupComplete?: boolean
    trust?: {
      defaultTrustLevel?: number
      tools?: Record<string, number>
      domains?: Record<string, number>
    }
    llm?: {
      mode?: 'local' | 'cloud'
      adapterId?: string
      model?: string
      endpoint?: string
      cloudWarnBeforeSending?: boolean
    }
  }
}

export interface ProfileUpdatePayload {
  profile: ProfileDoc
}