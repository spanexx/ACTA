import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  IPC_CHANNELS,
  type ModelProvider,
  type PermissionDecision,
  type PermissionRequestEvent,
  type PermissionResponsePayload,
  type ProfileInfo,
  type ProfileSetupConfig,
  type TrustLevel,
} from './ipc-contract'

let mainWindow: BrowserWindow | null = null

type PendingPermission = {
  resolve: (decision: PermissionDecision) => void
  timeout: NodeJS.Timeout
}

const pendingPermissions = new Map<string, PendingPermission>()

let activeProfileId = 'default'

function profilesRoot(): string {
  return path.join(app.getPath('userData'), 'profiles')
}

function activeProfileStatePath(): string {
  return path.join(app.getPath('userData'), 'activeProfile.json')
}

function profileDir(profileId: string): string {
  return path.join(profilesRoot(), profileId)
}

function logsDir(profileId: string): string {
  return path.join(profileDir(profileId), 'logs')
}

function normalizeProfileId(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const cleaned = trimmed.replace(/[^a-z0-9\-_.]/g, '-').replace(/-+/g, '-')
  return cleaned.length ? cleaned : 'profile'
}

function getActiveProfileId(): string {
  return activeProfileId
}

function profileConfigPath(profileId: string): string {
  return path.join(profileDir(profileId), 'config.json')
}

async function readProfileConfig(profileId: string): Promise<Record<string, unknown>> {
  const filePath = profileConfigPath(profileId)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

async function writeProfileConfig(profileId: string, next: Record<string, unknown>): Promise<void> {
  const filePath = profileConfigPath(profileId)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8')
}

function normalizeTrustLevel(value: unknown, fallback: TrustLevel): TrustLevel {
  const num = typeof value === 'number' ? value : Number(value)
  if (num === 0 || num === 1 || num === 2 || num === 3) return num
  return fallback
}

function normalizeModelProvider(value: unknown, fallback: ModelProvider): ModelProvider {
  if (value === 'ollama' || value === 'lmstudio' || value === 'openai' || value === 'anthropic') {
    return value
  }
  return fallback
}

async function loadActiveProfileId(): Promise<void> {
  const env = process.env.ACTA_PROFILE_ID
  if (env && env.trim().length) {
    activeProfileId = normalizeProfileId(env)
    return
  }

  try {
    const raw = await fs.readFile(activeProfileStatePath(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'object' && parsed !== null && typeof (parsed as any).profileId === 'string') {
      activeProfileId = normalizeProfileId((parsed as any).profileId)
    }
  } catch {
    
  }
}

async function persistActiveProfileId(profileId: string): Promise<void> {
  await fs.mkdir(path.dirname(activeProfileStatePath()), { recursive: true })
  await fs.writeFile(activeProfileStatePath(), JSON.stringify({ profileId }, null, 2), 'utf8')
}

async function ensureProfileExists(profileId: string, nameFallback: string): Promise<void> {
  await fs.mkdir(profileDir(profileId), { recursive: true })
  const cfg = await readProfileConfig(profileId)
  const name = typeof cfg.name === 'string' ? cfg.name : nameFallback
  const setupComplete = typeof cfg.setupComplete === 'boolean' ? cfg.setupComplete : false
  const trustLevel = normalizeTrustLevel(cfg.trustLevel, 1)
  const modelProvider = normalizeModelProvider(cfg.modelProvider, 'ollama')
  const endpoint = typeof cfg.endpoint === 'string' ? cfg.endpoint : 'http://localhost:11434'
  const model = typeof cfg.model === 'string' ? cfg.model : 'llama3:8b'
  const cloudWarnBeforeSending =
    typeof cfg.cloudWarnBeforeSending === 'boolean' ? cfg.cloudWarnBeforeSending : true

  await writeProfileConfig(profileId, {
    ...cfg,
    name,
    setupComplete,
    trustLevel,
    modelProvider,
    endpoint,
    model,
    cloudWarnBeforeSending,
  })
}

async function profileInfo(profileId: string): Promise<ProfileInfo> {
  const cfg = await readProfileConfig(profileId)
  const name = typeof cfg.name === 'string' ? cfg.name : profileId
  return {
    id: profileId,
    name,
    isActive: profileId === activeProfileId,
    dataPath: profileDir(profileId),
  }
}

async function listProfilesInternal(): Promise<ProfileInfo[]> {
  await fs.mkdir(profilesRoot(), { recursive: true })
  const entries = await fs.readdir(profilesRoot(), { withFileTypes: true })
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
  const ids = dirs.filter(name => !name.startsWith('_'))

  const profiles: ProfileInfo[] = []
  for (const id of ids) {
    profiles.push(await profileInfo(id))
  }

  profiles.sort((a, b) => {
    if (a.isActive) return -1
    if (b.isActive) return 1
    return a.name.localeCompare(b.name)
  })

  return profiles
}

function extractSetupConfig(cfg: Record<string, unknown>): ProfileSetupConfig {
  return {
    setupComplete: typeof cfg.setupComplete === 'boolean' ? cfg.setupComplete : false,
    modelProvider: normalizeModelProvider(cfg.modelProvider, 'ollama'),
    model: typeof cfg.model === 'string' ? cfg.model : 'llama3:8b',
    endpoint: typeof cfg.endpoint === 'string' ? cfg.endpoint : 'http://localhost:11434',
    cloudWarnBeforeSending:
      typeof cfg.cloudWarnBeforeSending === 'boolean' ? cfg.cloudWarnBeforeSending : true,
    trustLevel: normalizeTrustLevel(cfg.trustLevel, 1),
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  ipcMain.handle(IPC_CHANNELS.ping, async () => 'pong')

  ipcMain.handle(IPC_CHANNELS.profileList, async () => {
    const profiles = await listProfilesInternal()
    return { profiles, activeProfileId }
  })

  ipcMain.handle(IPC_CHANNELS.profileActive, async () => {
    return { profile: await profileInfo(activeProfileId) }
  })

  ipcMain.handle(IPC_CHANNELS.profileCreate, async (_event, payload: { name: string }) => {
    const baseName = (payload?.name ?? '').trim()
    const name = baseName.length ? baseName : 'New Profile'

    let idBase = normalizeProfileId(name)
    if (idBase === 'default') idBase = 'profile'

    let profileId = idBase
    for (let i = 2; i < 50; i++) {
      try {
        await fs.access(profileDir(profileId))
        profileId = `${idBase}-${i}`
      } catch {
        break
      }
    }

    const templateCfg = await readProfileConfig(activeProfileId)
    await writeProfileConfig(profileId, {
      ...templateCfg,
      name,
      setupComplete: false,
    })
    await ensureProfileExists(profileId, name)

    return { ok: true, profile: await profileInfo(profileId) }
  })

  ipcMain.handle(
    IPC_CHANNELS.profileDelete,
    async (_event, payload: { profileId: string; deleteFiles?: boolean }) => {
      const profileId = normalizeProfileId(payload?.profileId ?? '')
      if (!profileId.length || profileId === 'default') {
        return { ok: true }
      }

      if (profileId === activeProfileId) {
        activeProfileId = 'default'
        await ensureProfileExists(activeProfileId, 'Default')
        await persistActiveProfileId(activeProfileId)
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.profileChanged, {
            profile: await profileInfo(activeProfileId),
          })
        }
      }

      if (payload?.deleteFiles) {
        await fs.rm(profileDir(profileId), { recursive: true, force: true })
      } else {
        const archived = path.join(profilesRoot(), `_deleted-${profileId}-${Date.now().toString(10)}`)
        try {
          await fs.rename(profileDir(profileId), archived)
        } catch {
          await fs.rm(profileDir(profileId), { recursive: true, force: true })
        }
      }

      return { ok: true }
    },
  )

  ipcMain.handle(IPC_CHANNELS.profileSwitch, async (_event, payload: { profileId: string }) => {
    const next = normalizeProfileId(payload?.profileId ?? '')
    if (!next.length) {
      return { ok: true, profile: await profileInfo(activeProfileId) }
    }

    activeProfileId = next
    await ensureProfileExists(activeProfileId, activeProfileId)
    await persistActiveProfileId(activeProfileId)

    const profile = await profileInfo(activeProfileId)
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.profileChanged, { profile })
    }

    return { ok: true, profile }
  })

  ipcMain.handle(IPC_CHANNELS.trustGet, async () => {
    const profileId = getActiveProfileId()
    const cfg = await readProfileConfig(profileId)
    const trustLevel = normalizeTrustLevel(cfg.trustLevel, 1)
    return { trustLevel, profileId }
  })

  ipcMain.handle(IPC_CHANNELS.trustSet, async (_event, payload: { trustLevel: TrustLevel }) => {
    const profileId = getActiveProfileId()
    const cfg = await readProfileConfig(profileId)
    const trustLevel = normalizeTrustLevel(payload?.trustLevel, 1)
    await writeProfileConfig(profileId, { ...cfg, trustLevel })
    return { ok: true, trustLevel, profileId }
  })

  ipcMain.handle(IPC_CHANNELS.setupGet, async () => {
    const profileId = getActiveProfileId()
    const cfg = await readProfileConfig(profileId)
    return { profileId, config: extractSetupConfig(cfg) }
  })

  ipcMain.handle(IPC_CHANNELS.setupComplete, async (_event, payload: { config: ProfileSetupConfig }) => {
    const profileId = getActiveProfileId()
    const existing = await readProfileConfig(profileId)
    const merged: Record<string, unknown> = { ...existing, ...(payload?.config ?? {}), setupComplete: true }
    await writeProfileConfig(profileId, merged)
    return { ok: true, profileId, config: extractSetupConfig(merged) }
  })

  ipcMain.handle(IPC_CHANNELS.setupTestOllama, async (_event, payload: { endpoint: string }) => {
    const endpoint = (payload?.endpoint ?? '').trim()
    if (!endpoint.length) {
      return { ok: false, error: 'Missing endpoint' }
    }

    try {
      const base = new URL(endpoint)
      const tagsUrl = new URL('/api/tags', base)
      const res = await fetch(tagsUrl.toString(), { method: 'GET' })
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` }
      }

      const json = (await res.json()) as any
      const models = Array.isArray(json?.models)
        ? json.models.map((m: any) => m?.name).filter((n: any) => typeof n === 'string')
        : []

      return { ok: true, models }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.logsOpenFolder, async () => {
    const profileId = getActiveProfileId()
    const folder = logsDir(profileId)

    try {
      await fs.mkdir(folder, { recursive: true })
      const res = await shell.openPath(folder)
      if (res && res.length) {
        return { ok: false, path: folder, error: res }
      }
      return { ok: true, path: folder }
    } catch (err) {
      return { ok: false, path: folder, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.permissionResponse,
    async (_event, payload: PermissionResponsePayload) => {
      const pending = pendingPermissions.get(payload.requestId)
      if (pending) {
        clearTimeout(pending.timeout)
        pending.resolve(payload.decision)
        pendingPermissions.delete(payload.requestId)
      }

      return { ok: true }
    },
  )

  ipcMain.handle(IPC_CHANNELS.demoPermissionRequest, async event => {
    const requestId = randomUUID()

    const payload: PermissionRequestEvent = {
      id: requestId,
      tool: 'file.read',
      scope: '/Reports/Q4.pdf',
      reason: 'Read the file you referenced.',
      risk: 'Reads a local file from disk',
      risks: ['May reveal file contents to the UI/runtime'],
      reversible: true,
      rememberDecision: true,
      trustLevel: 1,
    }

    return await new Promise<PermissionDecision>(resolve => {
      const timeout = setTimeout(() => {
        pendingPermissions.delete(requestId)
        resolve('deny')
      }, 30_000)

      pendingPermissions.set(requestId, { resolve, timeout })
      event.sender.send(IPC_CHANNELS.permissionRequest, payload)
    })
  })

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/angular/browser/index.html'))
  } else {
    await mainWindow.loadURL('http://localhost:4200')
  }
}

app.on('ready', () => {
  void (async () => {
    await loadActiveProfileId()
    await ensureProfileExists(activeProfileId, activeProfileId === 'default' ? 'Default' : activeProfileId)
    await persistActiveProfileId(activeProfileId)
    await createWindow()
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})
