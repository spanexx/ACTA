/*
 * Code Map: Electron IPC Handlers
 * - registerIpcHandlers(): Registers all ipcMain.handle handlers for preload/renderer API calls.
 * - Profiles: list/active/create/delete/switch + profileChanged event emission.
 * - Trust/setup: get/set trust, get/complete setup, test Ollama endpoint.
 * - Logs: open logs folder.
 * - Demo permissions: demo permission request and permission response routing.
 *
 * CID Index:
 * CID:ipc-handlers-001 -> registerIpcHandlers
 * CID:ipc-handlers-002 -> ping handler
 * CID:ipc-handlers-003 -> profileList/profileActive
 * CID:ipc-handlers-004 -> profileCreate
 * CID:ipc-handlers-005 -> profileDelete
 * CID:ipc-handlers-006 -> profileSwitch (+ profileChanged emission)
 * CID:ipc-handlers-007 -> trustGet/trustSet
 * CID:ipc-handlers-008 -> setupGet/setupComplete
 * CID:ipc-handlers-009 -> setupTestOllama
 * CID:ipc-handlers-010 -> logsOpenFolder
 * CID:ipc-handlers-011 -> permissionResponse
 * CID:ipc-handlers-012 -> demoPermissionRequest
 *
 * Lookup: rg -n "CID:ipc-handlers-" apps/ui/electron/src/main/ipc-handlers.ts
 */

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

// CID:ipc-handlers-001 - IPC Registration Entrypoint
// Purpose: Registers all ipcMain handlers that back the preload ActaAPI.
// Uses: electron.ipcMain.handle, profile-config/profile-paths/profiles.service, PermissionsService, window-state
// Used by: electron/src/main.ts startup
export function registerIpcHandlers(): void {
  const permissions = new PermissionsService()

  // CID:ipc-handlers-002 - Ping
  // Purpose: Basic connectivity check for renderer.
  // Uses: IPC_CHANNELS.ping
  // Used by: preload ActaAPI.ping()
  ipcMain.handle(IPC_CHANNELS.ping, async () => 'pong')

  // CID:ipc-handlers-003 - Profile List/Active
  // Purpose: Returns profile list and active profile info.
  // Uses: listProfilesInternal(), profileInfo(), getActiveProfileId()
  // Used by: preload ActaAPI.listProfiles()/getActiveProfile()
  ipcMain.handle(IPC_CHANNELS.profileList, async () => {
    const profiles = await listProfilesInternal()
    return { profiles, activeProfileId: getActiveProfileId() }
  })

  ipcMain.handle(IPC_CHANNELS.profileActive, async () => {
    return { profile: await profileInfo(getActiveProfileId()) }
  })

  // CID:ipc-handlers-004 - Profile Create
  // Purpose: Creates a new profile by cloning the active profile config and ensuring required fields.
  // Uses: normalizeProfileId(), readProfileConfig(), writeProfileConfig(), ensureProfileExists()
  // Used by: preload ActaAPI.createProfile()
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

  // CID:ipc-handlers-005 - Profile Delete
  // Purpose: Deletes/archives a profile and falls back to default if deleting the active profile.
  // Uses: normalizeProfileId(), fs.rm/fs.rename, ensureProfileExists(), persistActiveProfileId(), getMainWindow() for profileChanged
  // Used by: preload ActaAPI.deleteProfile()
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

  // CID:ipc-handlers-006 - Profile Switch (+ profileChanged)
  // Purpose: Switches active profile, persists it, and notifies renderer via IPC_CHANNELS.profileChanged.
  // Uses: normalizeProfileId(), setActiveProfileId(), ensureProfileExists(), persistActiveProfileId(), getMainWindow()
  // Used by: preload ActaAPI.switchProfile()
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

  // CID:ipc-handlers-007 - Trust Get/Set
  // Purpose: Reads/writes trust level in profile config storage.
  // Uses: readProfileConfig(), writeProfileConfig(), normalizeTrustLevel()
  // Used by: preload ActaAPI.getTrustLevel()/setTrustLevel()
  ipcMain.handle(IPC_CHANNELS.trustGet, async () => {
    const profileId = getActiveProfileId()
    const cfg = await readProfileConfig(profileId)
    const trustLevel = normalizeTrustLevel(cfg['trustLevel'], 1)
    return { trustLevel, profileId }
  })

  ipcMain.handle(IPC_CHANNELS.trustSet, async (_event, payload: { trustLevel: TrustLevel }) => {
    const profileId = getActiveProfileId()
    const cfg = await readProfileConfig(profileId)
    const trustLevel = normalizeTrustLevel(payload?.trustLevel, 1)
    await writeProfileConfig(profileId, { ...cfg, trustLevel })
    return { ok: true, trustLevel, profileId }
  })

  // CID:ipc-handlers-008 - Setup Get/Complete
  // Purpose: Returns and persists setup-related config values.
  // Uses: readProfileConfig(), writeProfileConfig(), extractSetupConfig()
  // Used by: preload ActaAPI.getSetupConfig()/completeSetup()
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

  // CID:ipc-handlers-009 - Setup Test Ollama
  // Purpose: Tests an Ollama endpoint by calling /api/tags and returning discovered model names.
  // Uses: fetch(), URL, payload.endpoint
  // Used by: preload ActaAPI.testOllama()
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

  // CID:ipc-handlers-010 - Logs Open Folder
  // Purpose: Ensures logs directory exists and asks OS to open it.
  // Uses: logsDir(), fs.mkdir, shell.openPath
  // Used by: preload ActaAPI.openLogsFolder()
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

  // CID:ipc-handlers-011 - Permission Response
  // Purpose: Routes renderer permission decisions back to the PermissionsService.
  // Uses: PermissionsService.handlePermissionResponse()
  // Used by: preload ActaAPI.respondToPermission()
  ipcMain.handle(IPC_CHANNELS.permissionResponse, async (_event, payload: PermissionResponsePayload) => {
    permissions.handlePermissionResponse(payload)
    return { ok: true }
  })

  // CID:ipc-handlers-012 - Demo Permission Request
  // Purpose: Starts a demo permission request flow that emits a permissionRequest event and awaits response.
  // Uses: PermissionsService.demoPermissionRequest()
  // Used by: preload ActaAPI.demoPermissionRequest()
  ipcMain.handle(IPC_CHANNELS.demoPermissionRequest, async event => {
    return await permissions.demoPermissionRequest(event)
  })
}
