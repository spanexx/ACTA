/*
 * Code Map: IPC Contract (Main ↔ Renderer)
 * - IPC_CHANNELS: Stable channel names used by main + preload.
 * - Types: Shared payload shapes for IPC invoke/send usage.
 * - RendererToMain: Typed mapping for invoke request/response pairs.
 *
 * CID Index:
 * CID:ipc-contract-001 -> IPC_CHANNELS
 * CID:ipc-contract-002 -> IpcChannel
 * CID:ipc-contract-003 -> PermissionDecision
 * CID:ipc-contract-004 -> TrustLevel
 * CID:ipc-contract-005 -> ModelProvider
 * CID:ipc-contract-006 -> ProfileInfo
 * CID:ipc-contract-007 -> ProfileSetupConfig
 * CID:ipc-contract-008 -> PermissionRequestEvent
 * CID:ipc-contract-009 -> PermissionResponsePayload
 * CID:ipc-contract-010 -> RendererToMain
 *
 * Lookup: rg -n "CID:ipc-contract-" apps/ui/electron/src/ipc-contract.ts
 */

// CID:ipc-contract-001 - IPC Channel Names
// Purpose: Central list of IPC channel names to avoid typos across main/preload/renderer.
// Uses: const assertions
// Used by: electron/src/main/ipc-handlers.ts, electron/src/preload.ts
export const IPC_CHANNELS = {
  ping: 'acta:ping',
  permissionRequest: 'acta:permission.request',
  permissionResponse: 'acta:permission.response',
  demoPermissionRequest: 'acta:permission.demo',
  trustGet: 'acta:trust.get',
  trustSet: 'acta:trust.set',
  profileList: 'acta:profile.list',
  profileActive: 'acta:profile.active',
  profileCreate: 'acta:profile.create',
  profileDelete: 'acta:profile.delete',
  profileSwitch: 'acta:profile.switch',
  profileChanged: 'acta:profile.changed',
  setupGet: 'acta:setup.get',
  setupComplete: 'acta:setup.complete',
  setupTestOllama: 'acta:setup.testOllama',
  logsOpenFolder: 'acta:logs.openFolder',
} as const

// CID:ipc-contract-002 - IpcChannel
// Purpose: Union type of all IPC channel string values.
// Uses: typeof IPC_CHANNELS
// Used by: Type-level constraints for IPC wrappers
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// CID:ipc-contract-003 - PermissionDecision
// Purpose: Enumerates possible permission decisions.
// Uses: string union
// Used by: main permissions service, renderer permission UI, preload API
export type PermissionDecision = 'deny' | 'allow_once' | 'allow_always'

// CID:ipc-contract-004 - TrustLevel
// Purpose: Enumerates supported trust levels.
// Uses: numeric union
// Used by: trust state + setup state flows
export type TrustLevel = 0 | 1 | 2 | 3

// CID:ipc-contract-005 - ModelProvider
// Purpose: Enumerates supported LLM provider ids.
// Uses: string union
// Used by: setup/profile config
export type ModelProvider = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini'

// CID:ipc-contract-006 - ProfileInfo
// Purpose: Renderer-facing profile summary used in UI.
// Uses: primitive fields
// Used by: profile list/switch IPC APIs
export type ProfileInfo = {
  id: string
  name: string
  isActive: boolean
  dataPath: string
}

// CID:ipc-contract-007 - ProfileSetupConfig
// Purpose: Renderer-facing setup config subset.
// Uses: optional fields for provider config
// Used by: setupGet/setupComplete IPC
export type ProfileSetupConfig = {
  setupComplete: boolean
  modelProvider?: ModelProvider
  model?: string
  endpoint?: string
  cloudWarnBeforeSending?: boolean
  trustLevel?: TrustLevel
}

// CID:ipc-contract-008 - PermissionRequestEvent
// Purpose: Permission request payload sent from main to renderer.
// Uses: tool/action/scope/input metadata
// Used by: PermissionStateService via RuntimeEventsService + ActaAPI listener
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
  cloud?: {
    provider: string
    model?: string
  }
}

// CID:ipc-contract-009 - PermissionResponsePayload
// Purpose: Permission decision response payload sent from renderer to main.
// Uses: requestId, decision, remember
// Used by: ipc-handlers.ts permissionResponse handler; preload respondToPermission
export type PermissionResponsePayload = {
  requestId: string
  decision: PermissionDecision
  remember?: boolean
}

// CID:ipc-contract-010 - RendererToMain Invoke Contract
// Purpose: Typed mapping of invoke channel -> request/response payloads.
// Uses: IPC_CHANNELS keys
// Used by: Potential typed IPC wrapper layers
export type RendererToMain = {
  [IPC_CHANNELS.ping]: { request: undefined; response: string }
  [IPC_CHANNELS.permissionResponse]: {
    request: PermissionResponsePayload
    response: { ok: true }
  }
  [IPC_CHANNELS.demoPermissionRequest]: {
    request: undefined
    response: PermissionDecision
  }
  [IPC_CHANNELS.trustGet]: {
    request: undefined
    response: { trustLevel: TrustLevel; profileId: string }
  }
  [IPC_CHANNELS.trustSet]: {
    request: { trustLevel: TrustLevel }
    response: { ok: true; trustLevel: TrustLevel; profileId: string }
  }
  [IPC_CHANNELS.profileList]: {
    request: undefined
    response: { profiles: ProfileInfo[]; activeProfileId: string }
  }
  [IPC_CHANNELS.profileActive]: {
    request: undefined
    response: { profile: ProfileInfo }
  }
  [IPC_CHANNELS.profileCreate]: {
    request: { name: string }
    response: { ok: true; profile: ProfileInfo }
  }
  [IPC_CHANNELS.profileDelete]: {
    request: { profileId: string; deleteFiles?: boolean }
    response: { ok: true }
  }
  [IPC_CHANNELS.profileSwitch]: {
    request: { profileId: string }
    response: { ok: true; profile: ProfileInfo }
  }
  [IPC_CHANNELS.setupGet]: {
    request: undefined
    response: { profileId: string; config: ProfileSetupConfig }
  }
  [IPC_CHANNELS.setupComplete]: {
    request: { config: ProfileSetupConfig }
    response: { ok: true; profileId: string; config: ProfileSetupConfig }
  }
  [IPC_CHANNELS.setupTestOllama]: {
    request: { endpoint: string }
    response: { ok: boolean; models?: string[]; error?: string }
  }
  [IPC_CHANNELS.logsOpenFolder]: {
    request: undefined
    response: { ok: boolean; path: string; error?: string }
  }
}
