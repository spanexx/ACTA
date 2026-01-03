/*
 * Code Map: IPC API Types
 * - ActaMessage & ActaMessageType: Envelope metadata and message type union
 * - Task/Agent/Permission/Profile payloads: Shared schemas for IPC events
 *
 * CID Index:
 * CID:ipc-types-001 -> ActaMessage interface
 * CID:ipc-types-002 -> ActaMessageType union
 * CID:ipc-types-003 -> TaskRequest interface
 * CID:ipc-types-004 -> TaskStopRequest interface
 * CID:ipc-types-005 -> RuntimeTask interface
 * CID:ipc-types-006 -> AgentPlan interface
 * CID:ipc-types-007 -> AgentStep interface
 * CID:ipc-types-008 -> ToolResult interface
 * CID:ipc-types-009 -> TaskPlanPayload interface
 * CID:ipc-types-010 -> TaskStepPayload interface
 * CID:ipc-types-011 -> TaskResultPayload interface
 * CID:ipc-types-012 -> TaskErrorPayload interface
 * CID:ipc-types-013 -> PermissionRequestPayload interface
 * CID:ipc-types-014 -> PermissionResponsePayload interface
 * CID:ipc-types-015 -> ProfileSummary/List/Create/Delete/Switch/Get/Update payloads
 *
 * Quick lookup: rg -n "CID:ipc-types-" /home/spanexx/Shared/Projects/ACTA/packages/ipc/src/types.ts
 */

// CID:ipc-types-001 - ActaMessage interface
// Purpose: Shared envelope for IPC messages
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

// CID:ipc-types-002 - ActaMessageType
// Purpose: Enumerate all IPC message kinds
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

// CID:ipc-types-003 - TaskRequest
// Purpose: Payload for initiating a task
export interface TaskRequest {
  input: string
  context?: {
    files?: string[]
    screen?: boolean
    clipboard?: boolean
  }
  trustLevel?: 'low' | 'medium' | 'high'
}

// CID:ipc-types-004 - TaskStopRequest
// Purpose: Payload for cancelling a task
export interface TaskStopRequest {
  correlationId?: string
}

// CID:ipc-types-005 - RuntimeTask
// Purpose: Internal runtime representation of task metadata
export interface RuntimeTask {
  taskId: string
  correlationId: string
  profileId: string
  input: string
  attachments?: string[]
}

// CID:ipc-types-006 - AgentPlan
// Purpose: Structured plan produced by planner
export interface AgentPlan {
  goal: string
  steps: AgentStep[]
  risks?: string[]
}

// CID:ipc-types-007 - AgentStep
// Purpose: Per-step instruction within agent plan
export interface AgentStep {
  id: string
  tool: string
  intent: string
  input: any
  requiresPermission: boolean
}

// CID:ipc-types-008 - ToolResult
// Purpose: Tool execution output schema
export interface ToolResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: string[] // file paths
}

// Runtime-to-UI event payloads (examples for future use)
// CID:ipc-types-009 - TaskPlanPayload
export interface TaskPlanPayload {
  goal: string
  steps: AgentStep[]
  risks?: string[]
}
// CID:ipc-types-010 - TaskStepPayload
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
// CID:ipc-types-011 - TaskResultPayload
export interface TaskResultPayload {
  success: boolean
  goal?: string
  report: string
  results?: ToolResult[]
}
// CID:ipc-types-012 - TaskErrorPayload
export interface TaskErrorPayload {
  taskId: string
  code: string
  message: string
  stepId?: string
  details?: string
}
// CID:ipc-types-013 - PermissionRequestPayload
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

// CID:ipc-types-014 - PermissionResponsePayload
export interface PermissionResponsePayload {
  requestId: string
  decision: 'allow' | 'deny'
  remember?: boolean
}

// CID:ipc-types-015a - ProfileSummary
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
    baseUrl?: string
    endpoint?: string
    cloudWarnBeforeSending?: boolean
    defaults?: {
      temperature?: number
      maxTokens?: number
    }
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
      baseUrl?: string
      endpoint?: string
      cloudWarnBeforeSending?: boolean
      defaults?: {
        temperature?: number
        maxTokens?: number
      }
    }
  }
}

export interface ProfileUpdatePayload {
  profile: ProfileDoc
}