/*
 * Code Map: Profile State (Main Process)
 * - Tracks activeProfileId in-memory and persists it to disk.
 * - Ensures profiles exist and provides profile listing/info for IPC.
 *
 * CID Index:
 * CID:profiles.service-001 -> activeProfileId (module state)
 * CID:profiles.service-002 -> getActiveProfileId
 * CID:profiles.service-003 -> setActiveProfileId
 * CID:profiles.service-004 -> loadActiveProfileId
 * CID:profiles.service-005 -> persistActiveProfileId
 * CID:profiles.service-006 -> ensureProfileExists
 * CID:profiles.service-007 -> profileInfo
 * CID:profiles.service-008 -> listProfilesInternal
 * CID:profiles.service-009 -> normalizeTrustUpdate
 * CID:profiles.service-010 -> normalizeProfileId re-export
 *
 * Lookup: rg -n "CID:profiles.service-" apps/ui/electron/src/main/profiles.service.ts
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ProfileInfo, TrustLevel } from '../ipc-contract'
import { activeProfileStatePath, profileDir, profilesRoot } from './profile-paths'
import {
  normalizeModelProvider,
  normalizeProfileId,
  normalizeTrustLevel,
  readProfileConfig,
  writeProfileConfig,
} from './profile-config'

// CID:profiles.service-001 - Active Profile ID (Module State)
// Purpose: Stores the active profile id for the main process.
// Uses: string state, persisted via load/persist functions
// Used by: ipc-handlers.ts (profile operations); main.ts bootstrap
let activeProfileId = 'default'

// CID:profiles.service-002 - Get Active Profile ID
// Purpose: Returns the current active profile id.
// Uses: activeProfileId module state
// Used by: ipc-handlers.ts and main.ts
export function getActiveProfileId(): string {
  return activeProfileId
}

// CID:profiles.service-003 - Set Active Profile ID
// Purpose: Updates the in-memory active profile id.
// Uses: activeProfileId module state
// Used by: ipc-handlers.ts (profileSwitch/profileDelete)
export function setActiveProfileId(profileId: string): void {
  activeProfileId = profileId
}

// CID:profiles.service-004 - Load Active Profile ID
// Purpose: Loads active profile id from env or persisted JSON file.
// Uses: process.env['ACTA_PROFILE_ID'], fs.readFile, JSON.parse
// Used by: main.ts on app ready
export async function loadActiveProfileId(): Promise<void> {
  const env = process.env['ACTA_PROFILE_ID']
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
    // ignore
  }
}

// CID:profiles.service-005 - Persist Active Profile ID
// Purpose: Persists active profile id to disk under userData.
// Uses: fs.mkdir, fs.writeFile, activeProfileStatePath()
// Used by: main.ts bootstrap; ipc-handlers.ts when switching profiles
export async function persistActiveProfileId(profileId: string): Promise<void> {
  await fs.mkdir(path.dirname(activeProfileStatePath()), { recursive: true })
  await fs.writeFile(activeProfileStatePath(), JSON.stringify({ profileId }, null, 2), 'utf8')
}

// CID:profiles.service-006 - Ensure Profile Exists
// Purpose: Creates profile directories and ensures required config fields exist.
// Uses: profileDir(), readProfileConfig(), writeProfileConfig(), normalize* helpers
// Used by: main.ts bootstrap; ipc-handlers.ts profile create/switch/delete
export async function ensureProfileExists(profileId: string, nameFallback: string): Promise<void> {
  await fs.mkdir(profileDir(profileId), { recursive: true })
  const cfg = await readProfileConfig(profileId)
  const name = typeof cfg['name'] === 'string' ? (cfg['name'] as string) : nameFallback
  const setupComplete = typeof cfg['setupComplete'] === 'boolean' ? (cfg['setupComplete'] as boolean) : false
  const trustLevel = normalizeTrustLevel(cfg['trustLevel'], 1)
  const modelProvider = normalizeModelProvider(cfg['modelProvider'], 'ollama')
  const endpoint = typeof cfg['endpoint'] === 'string' ? (cfg['endpoint'] as string) : 'http://localhost:11434'
  const model = typeof cfg['model'] === 'string' ? (cfg['model'] as string) : 'llama3:8b'
  const cloudWarnBeforeSending =
    typeof cfg['cloudWarnBeforeSending'] === 'boolean' ? (cfg['cloudWarnBeforeSending'] as boolean) : true

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

// CID:profiles.service-007 - Build ProfileInfo
// Purpose: Builds the ProfileInfo view for a profile id.
// Uses: readProfileConfig(), profileDir(), activeProfileId module state
// Used by: ipc-handlers.ts (profileActive/profileList/profileSwitch)
export async function profileInfo(profileId: string): Promise<ProfileInfo> {
  const cfg = await readProfileConfig(profileId)
  const name = typeof cfg['name'] === 'string' ? (cfg['name'] as string) : profileId
  return {
    id: profileId,
    name,
    isActive: profileId === activeProfileId,
    dataPath: profileDir(profileId),
  }
}

// CID:profiles.service-008 - List Profiles
// Purpose: Lists all profile directories and returns sorted ProfileInfo entries.
// Uses: profilesRoot(), fs.readdir, profileInfo()
// Used by: ipc-handlers.ts (profileList)
export async function listProfilesInternal(): Promise<ProfileInfo[]> {
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

// CID:profiles.service-009 - Normalize Trust Update
// Purpose: Compatibility wrapper around normalizeTrustLevel.
// Uses: normalizeTrustLevel()
// Used by: (best-effort) call sites that expect this symbol
export function normalizeTrustUpdate(value: unknown, fallback: TrustLevel): TrustLevel {
  return normalizeTrustLevel(value, fallback)
}

// CID:profiles.service-010 - Re-export normalizeProfileId
// Purpose: Re-exports normalizeProfileId for callers that import from profiles.service.
// Uses: normalizeProfileId (from profile-config)
// Used by: ipc-handlers.ts
export { normalizeProfileId }
