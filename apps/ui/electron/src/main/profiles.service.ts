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

let activeProfileId = 'default'

export function getActiveProfileId(): string {
  return activeProfileId
}

export function setActiveProfileId(profileId: string): void {
  activeProfileId = profileId
}

export async function loadActiveProfileId(): Promise<void> {
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
    // ignore
  }
}

export async function persistActiveProfileId(profileId: string): Promise<void> {
  await fs.mkdir(path.dirname(activeProfileStatePath()), { recursive: true })
  await fs.writeFile(activeProfileStatePath(), JSON.stringify({ profileId }, null, 2), 'utf8')
}

export async function ensureProfileExists(profileId: string, nameFallback: string): Promise<void> {
  await fs.mkdir(profileDir(profileId), { recursive: true })
  const cfg = await readProfileConfig(profileId)
  const name = typeof cfg.name === 'string' ? cfg.name : nameFallback
  const setupComplete = typeof cfg.setupComplete === 'boolean' ? cfg.setupComplete : false
  const trustLevel = normalizeTrustLevel(cfg.trustLevel, 1)
  const modelProvider = normalizeModelProvider(cfg.modelProvider, 'ollama')
  const endpoint = typeof cfg.endpoint === 'string' ? cfg.endpoint : 'http://localhost:11434'
  const model = typeof cfg.model === 'string' ? cfg.model : 'llama3:8b'
  const cloudWarnBeforeSending = typeof cfg.cloudWarnBeforeSending === 'boolean' ? cfg.cloudWarnBeforeSending : true

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

export async function profileInfo(profileId: string): Promise<ProfileInfo> {
  const cfg = await readProfileConfig(profileId)
  const name = typeof cfg.name === 'string' ? cfg.name : profileId
  return {
    id: profileId,
    name,
    isActive: profileId === activeProfileId,
    dataPath: profileDir(profileId),
  }
}

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

export function normalizeTrustUpdate(value: unknown, fallback: TrustLevel): TrustLevel {
  return normalizeTrustLevel(value, fallback)
}

export { normalizeProfileId }
