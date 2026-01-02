import type { ActaMessage } from '@acta/ipc'

export type Unsubscribe = () => void

export type PermissionDecision = 'deny' | 'allow_once' | 'allow_always'

export type TrustLevel = 0 | 1 | 2 | 3

export type ModelProvider = 'ollama' | 'lmstudio' | 'openai' | 'anthropic'

export type ProfileInfo = {
  id: string
  name: string
  isActive: boolean
  dataPath: string
}

export type ProfileSetupConfig = {
  setupComplete: boolean
  modelProvider?: ModelProvider
  model?: string
  endpoint?: string
  cloudWarnBeforeSending?: boolean
  trustLevel?: TrustLevel
}

export type PermissionRequestEvent = {
  id: string
  tool: string
  action?: string
  scope?: string
  input?: string
  output?: string
  reason: string
  risk?: string
  risks?: string[]
  reversible: boolean
  rememberDecision?: boolean
  trustLevel?: number
  correlationId?: string
  replyTo?: string
  requestId?: string
  cloud?: {
    provider: string
    model?: string
  }
}

export type PermissionResponsePayload = {
  requestId: string
  decision: PermissionDecision
  remember?: boolean
}

export type ActaApi = {
  ping: () => Promise<string>
  onPermissionRequest: (handler: (event: PermissionRequestEvent) => void) => Unsubscribe
  respondToPermission: (payload: PermissionResponsePayload) => Promise<{ ok: true }>
  demoPermissionRequest: () => Promise<PermissionDecision>
  getTrustLevel: () => Promise<{ trustLevel: TrustLevel; profileId: string }>
  setTrustLevel: (payload: { trustLevel: TrustLevel }) => Promise<{
    ok: true
    trustLevel: TrustLevel
    profileId: string
  }>
  listProfiles: () => Promise<{ profiles: ProfileInfo[]; activeProfileId: string }>
  getActiveProfile: () => Promise<{ profile: ProfileInfo }>
  createProfile: (payload: { name: string }) => Promise<{ ok: true; profile: ProfileInfo }>
  deleteProfile: (payload: { profileId: string; deleteFiles?: boolean }) => Promise<{ ok: true }>
  switchProfile: (payload: { profileId: string }) => Promise<{ ok: true; profile: ProfileInfo }>
  onProfileChanged: (handler: (payload: { profile: ProfileInfo }) => void) => Unsubscribe
  getSetupConfig: () => Promise<{ profileId: string; config: ProfileSetupConfig }>
  completeSetup: (payload: { config: ProfileSetupConfig }) => Promise<{
    ok: true
    profileId: string
    config: ProfileSetupConfig
  }>
  testOllama: (payload: { endpoint: string }) => Promise<{ ok: boolean; models?: string[]; error?: string }>
  openLogsFolder: () => Promise<{ ok: boolean; path: string; error?: string }>
}

declare global {
  interface Window {
    ActaAPI?: ActaApi
  }
}

export type ChatMessageType = 'user' | 'acta' | 'system'

export type PlanStepStatus = 'pending' | 'in-progress' | 'completed' | 'failed'

export type ChatPlanStep = {
  id: string
  title: string
  status: PlanStepStatus
}

export type ChatPlanBlock = {
  goal: string
  collapsed: boolean
  steps: ChatPlanStep[]
}

export type Attachment = {
  id: string
  name: string
  size: number
  path?: string
}

export type ChatMessage = {
  id: string
  type: ChatMessageType
  timestamp: number
  text: string
  attachments?: Attachment[]
  plan?: ChatPlanBlock
}

export type ToolOutputStatus = 'waiting_permission' | 'running' | 'completed' | 'error'

export type ToolOutputFilter = 'all' | 'active' | 'completed' | 'errors'

export type ToolOutputArtifact = {
  path: string
}

export type ToolOutputEntry = {
  id: string
  timestamp: number
  tool: string
  status: ToolOutputStatus
  scope?: string
  input?: string
  reason?: string
  preview?: string
  error?: string
  progress?: number
  artifacts?: ToolOutputArtifact[]
  raw: unknown
  expanded: boolean
}

export type AnyActaMessage = ActaMessage<any>
