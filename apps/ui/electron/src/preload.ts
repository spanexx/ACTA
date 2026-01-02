import { contextBridge, ipcRenderer } from 'electron'

const IPC_CHANNELS = {
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

type Unsubscribe = () => void

type PermissionDecision = 'deny' | 'allow_once' | 'allow_always'

type TrustLevel = 0 | 1 | 2 | 3

type ModelProvider = 'ollama' | 'lmstudio' | 'openai' | 'anthropic'

type ProfileInfo = {
  id: string
  name: string
  isActive: boolean
  dataPath: string
}

type ProfileSetupConfig = {
  setupComplete: boolean
  modelProvider?: ModelProvider
  model?: string
  endpoint?: string
  cloudWarnBeforeSending?: boolean
  trustLevel?: TrustLevel
}

type PermissionRequestEvent = {
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

type PermissionResponsePayload = {
  requestId: string
  decision: PermissionDecision
  remember?: boolean
}

type ActaApi = {
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

const api: ActaApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
  onPermissionRequest: handler => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PermissionRequestEvent) => {
      handler(payload)
    }

    ipcRenderer.on(IPC_CHANNELS.permissionRequest, listener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.permissionRequest, listener)
    }
  },
  respondToPermission: payload => ipcRenderer.invoke(IPC_CHANNELS.permissionResponse, payload),
  demoPermissionRequest: () => ipcRenderer.invoke(IPC_CHANNELS.demoPermissionRequest),
  getTrustLevel: () => ipcRenderer.invoke(IPC_CHANNELS.trustGet),
  setTrustLevel: payload => ipcRenderer.invoke(IPC_CHANNELS.trustSet, payload),
  listProfiles: () => ipcRenderer.invoke(IPC_CHANNELS.profileList),
  getActiveProfile: () => ipcRenderer.invoke(IPC_CHANNELS.profileActive),
  createProfile: payload => ipcRenderer.invoke(IPC_CHANNELS.profileCreate, payload),
  deleteProfile: payload => ipcRenderer.invoke(IPC_CHANNELS.profileDelete, payload),
  switchProfile: payload => ipcRenderer.invoke(IPC_CHANNELS.profileSwitch, payload),
  onProfileChanged: handler => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { profile: ProfileInfo }) => {
      handler(payload)
    }

    ipcRenderer.on(IPC_CHANNELS.profileChanged, listener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.profileChanged, listener)
    }
  },
  getSetupConfig: () => ipcRenderer.invoke(IPC_CHANNELS.setupGet),
  completeSetup: payload => ipcRenderer.invoke(IPC_CHANNELS.setupComplete, payload),
  testOllama: payload => ipcRenderer.invoke(IPC_CHANNELS.setupTestOllama, payload),
  openLogsFolder: () => ipcRenderer.invoke(IPC_CHANNELS.logsOpenFolder),
}

contextBridge.exposeInMainWorld('ActaAPI', api)
