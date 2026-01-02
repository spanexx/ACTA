import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ModelProvider, ProfileSetupConfig, TrustLevel } from '../ipc-contract'
import { profileDir } from './profile-paths'

export function normalizeProfileId(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const cleaned = trimmed.replace(/[^a-z0-9\-_.]/g, '-').replace(/-+/g, '-')
  return cleaned.length ? cleaned : 'profile'
}

export function normalizeTrustLevel(value: unknown, fallback: TrustLevel): TrustLevel {
  const num = typeof value === 'number' ? value : Number(value)
  if (num === 0 || num === 1 || num === 2 || num === 3) return num
  return fallback
}

export function normalizeModelProvider(value: unknown, fallback: ModelProvider): ModelProvider {
  if (value === 'ollama' || value === 'lmstudio' || value === 'openai' || value === 'anthropic') {
    return value
  }
  return fallback
}

function profileConfigPath(profileId: string): string {
  return path.join(profileDir(profileId), 'config.json')
}

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

export async function writeProfileConfig(profileId: string, next: Record<string, unknown>): Promise<void> {
  const filePath = profileConfigPath(profileId)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8')
}

export function extractSetupConfig(cfg: Record<string, unknown>): ProfileSetupConfig {
  return {
    setupComplete: typeof cfg.setupComplete === 'boolean' ? cfg.setupComplete : false,
    modelProvider: normalizeModelProvider(cfg.modelProvider, 'ollama'),
    model: typeof cfg.model === 'string' ? cfg.model : 'llama3:8b',
    endpoint: typeof cfg.endpoint === 'string' ? cfg.endpoint : 'http://localhost:11434',
    cloudWarnBeforeSending: typeof cfg.cloudWarnBeforeSending === 'boolean' ? cfg.cloudWarnBeforeSending : true,
    trustLevel: normalizeTrustLevel(cfg.trustLevel, 1),
  }
}
