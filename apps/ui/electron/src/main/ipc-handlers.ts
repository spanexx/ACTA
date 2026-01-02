import { ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  IPC_CHANNELS,
  type PermissionResponsePayload,
  type ProfileSetupConfig,
  type TrustLevel,
} from '../ipc-contract'
import {
  extractSetupConfig,
  normalizeTrustLevel,
  readProfileConfig,
  writeProfileConfig,
} from './profile-config'
import { logsDir, profileDir, profilesRoot } from './profile-paths'
import {
  ensureProfileExists,
  getActiveProfileId,
  listProfilesInternal,
  normalizeProfileId,
  persistActiveProfileId,
  profileInfo,
  setActiveProfileId,
} from './profiles.service'
import { PermissionsService } from './permissions.service'
import { getMainWindow } from './window-state'

export function registerIpcHandlers(): void {
  const permissions = new PermissionsService()

  ipcMain.handle(IPC_CHANNELS.ping, async () => 'pong')

  ipcMain.handle(IPC_CHANNELS.profileList, async () => {
    const profiles = await listProfilesInternal()
    return { profiles, activeProfileId: getActiveProfileId() }
  })

  ipcMain.handle(IPC_CHANNELS.profileActive, async () => {
    return { profile: await profileInfo(getActiveProfileId()) }
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

    const templateCfg = await readProfileConfig(getActiveProfileId())
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

      const activeId = getActiveProfileId()
      if (profileId === activeId) {
        setActiveProfileId('default')
        await ensureProfileExists(getActiveProfileId(), 'Default')
        await persistActiveProfileId(getActiveProfileId())

        const win = getMainWindow()
        if (win) {
          win.webContents.send(IPC_CHANNELS.profileChanged, {
            profile: await profileInfo(getActiveProfileId()),
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
      return { ok: true, profile: await profileInfo(getActiveProfileId()) }
    }

    setActiveProfileId(next)
    await ensureProfileExists(getActiveProfileId(), getActiveProfileId())
    await persistActiveProfileId(getActiveProfileId())

    const profile = await profileInfo(getActiveProfileId())
    const win = getMainWindow()
    if (win) {
      win.webContents.send(IPC_CHANNELS.profileChanged, { profile })
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

  ipcMain.handle(IPC_CHANNELS.permissionResponse, async (_event, payload: PermissionResponsePayload) => {
    permissions.handlePermissionResponse(payload)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.demoPermissionRequest, async event => {
    return await permissions.demoPermissionRequest(event)
  })
}
