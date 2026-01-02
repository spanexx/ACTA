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

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

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
