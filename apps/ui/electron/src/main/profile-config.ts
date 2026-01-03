/*
 * Code Map: Profile Config Persistence
 * - Normalizers: normalizeProfileId / normalizeTrustLevel / normalizeModelProvider
 * - Persistence: readProfileConfig / writeProfileConfig (config.json per profile)
 * - extractSetupConfig(): Builds renderer-facing setup config from raw config object.
 *
 * CID Index:
 * CID:profile-config-001 -> normalizeProfileId
 * CID:profile-config-002 -> normalizeTrustLevel
 * CID:profile-config-003 -> normalizeModelProvider
 * CID:profile-config-004 -> profileConfigPath
 * CID:profile-config-005 -> readProfileConfig
 * CID:profile-config-006 -> writeProfileConfig
 * CID:profile-config-007 -> extractSetupConfig
 *
 * Lookup: rg -n "CID:profile-config-" apps/ui/electron/src/main/profile-config.ts
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ModelProvider, ProfileSetupConfig, TrustLevel } from '../ipc-contract'
import { profileDir } from './profile-paths'

// CID:profile-config-001 - Normalize Profile ID
// Purpose: Normalizes a user-provided profile identifier to a filesystem-safe slug.
// Uses: string normalization + regex replacement
// Used by: profiles.service.ts (active profile handling); ipc-handlers.ts (create/delete/switch)
export function normalizeProfileId(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const cleaned = trimmed.replace(/[^a-z0-9\-_.]/g, '-').replace(/-+/g, '-')
  return cleaned.length ? cleaned : 'profile'
}

// CID:profile-config-002 - Normalize Trust Level
// Purpose: Coerces unknown input to a TrustLevel (0..3) with a fallback.
// Uses: numeric coercion
// Used by: ipc-handlers.ts trustGet/trustSet; extractSetupConfig; profiles.service.ts ensureProfileExists
export function normalizeTrustLevel(value: unknown, fallback: TrustLevel): TrustLevel {
  const num = typeof value === 'number' ? value : Number(value)
  if (num === 0 || num === 1 || num === 2 || num === 3) return num
  return fallback
}

// CID:profile-config-003 - Normalize Model Provider
// Purpose: Validates/coerces provider identifiers to the supported union.
// Uses: ModelProvider union
// Used by: extractSetupConfig; profiles.service.ts ensureProfileExists
export function normalizeModelProvider(value: unknown, fallback: ModelProvider): ModelProvider {
  if (value === 'ollama' || value === 'lmstudio' || value === 'openai' || value === 'anthropic' || value === 'gemini') {
    return value
  }
  return fallback
}

// CID:profile-config-004 - Config File Path
// Purpose: Computes the config.json path for a profile.
// Uses: profileDir()
// Used by: readProfileConfig/writeProfileConfig
function profileConfigPath(profileId: string): string {
  return path.join(profileDir(profileId), 'config.json')
}

// CID:profile-config-005 - Read Profile Config
// Purpose: Reads config.json and returns a defensive Record<string, unknown>.
// Uses: fs.readFile, JSON.parse
// Used by: ipc-handlers.ts, profiles.service.ts
export async function readProfileConfig(profileId: string): Promise<Record<string, unknown>> {
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

// CID:profile-config-006 - Write Profile Config
// Purpose: Writes config.json for a profile, creating directories as needed.
// Uses: fs.mkdir, fs.writeFile
// Used by: ipc-handlers.ts, profiles.service.ts
export async function writeProfileConfig(profileId: string, next: Record<string, unknown>): Promise<void> {
  const filePath = profileConfigPath(profileId)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8')
}

// CID:profile-config-007 - Extract Setup Config
// Purpose: Converts raw config storage into a renderer-friendly setup configuration shape.
// Uses: normalizeModelProvider(), normalizeTrustLevel()
// Used by: ipc-handlers.ts setupGet/setupComplete
export function extractSetupConfig(cfg: Record<string, unknown>): ProfileSetupConfig {
  return {
    setupComplete: typeof cfg['setupComplete'] === 'boolean' ? (cfg['setupComplete'] as boolean) : false,
    modelProvider: normalizeModelProvider(cfg['modelProvider'], 'ollama'),
    model: typeof cfg['model'] === 'string' ? (cfg['model'] as string) : 'llama3:8b',
    endpoint: typeof cfg['endpoint'] === 'string' ? (cfg['endpoint'] as string) : 'http://localhost:11434',
    cloudWarnBeforeSending:
      typeof cfg['cloudWarnBeforeSending'] === 'boolean' ? (cfg['cloudWarnBeforeSending'] as boolean) : true,
    trustLevel: normalizeTrustLevel(cfg['trustLevel'], 1),
  }
}
