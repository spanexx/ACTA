import fs from 'node:fs/promises'
import path from 'node:path'

import type { LLMProviderId, TrustLevel } from '@acta/profiles'

import type { ProfileServiceState } from '../state'
import { resolveLegacyProfilesRoot, readLegacyActiveProfileId } from './legacy-root'
import { hasLegacyMigrationMarker, writeLegacyMigrationMarker } from './marker'

export async function maybeMigrateLegacyProfiles(state: ProfileServiceState): Promise<string | null> {
  const force = (process.env.ACTA_FORCE_LEGACY_MIGRATION ?? '').trim() === '1'
  if (!force) {
    const hasMarker = await hasLegacyMigrationMarker(state.profileRoot)
    if (hasMarker) return null
  }

  const legacyProfilesRoot = await resolveLegacyProfilesRoot()
  if (!legacyProfilesRoot) return null

  const runtimeRoot = path.resolve(state.profileRoot)
  const legacyRootResolved = path.resolve(legacyProfilesRoot)
  if (legacyRootResolved === runtimeRoot) {
    await writeLegacyMigrationMarker(state.profileRoot, {
      legacyProfilesRoot: legacyRootResolved,
      completedAt: Date.now(),
    })
    return null
  }

  const legacyActiveId = await readLegacyActiveProfileId(legacyRootResolved)

  let entries: Array<{ name: string; isDir: boolean }> = []
  try {
    const dirents = await fs.readdir(legacyRootResolved, { withFileTypes: true })
    entries = dirents.map(d => ({ name: d.name, isDir: d.isDirectory() }))
  } catch {
    return null
  }

  for (const e of entries) {
    if (!e.isDir) continue
    const profileId = e.name
    if (profileId.startsWith('_')) continue
    if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(profileId)) continue

    try {
      await state.store.read(profileId)
      continue
    } catch {
    }

    const configPath = path.join(legacyRootResolved, profileId, 'config.json')
    let cfgRaw: any = null
    try {
      const raw = await fs.readFile(configPath, 'utf8')
      cfgRaw = JSON.parse(raw)
    } catch {
      cfgRaw = null
    }

    const name = typeof cfgRaw?.name === 'string' && cfgRaw.name.trim().length ? cfgRaw.name.trim() : profileId
    const setupComplete = typeof cfgRaw?.setupComplete === 'boolean' ? cfgRaw.setupComplete : false

    const trustLevelNum = typeof cfgRaw?.trustLevel === 'number' ? cfgRaw.trustLevel : Number(cfgRaw?.trustLevel)
    const trustLevel: TrustLevel =
      (trustLevelNum === 0 || trustLevelNum === 1 || trustLevelNum === 2 || trustLevelNum === 3 ? trustLevelNum : 2) as TrustLevel

    const adapterIdRaw =
      typeof cfgRaw?.modelProvider === 'string' && cfgRaw.modelProvider.trim().length ? cfgRaw.modelProvider : 'ollama'
    const adapterId: LLMProviderId =
      adapterIdRaw === 'ollama' ||
      adapterIdRaw === 'lmstudio' ||
      adapterIdRaw === 'openai' ||
      adapterIdRaw === 'anthropic' ||
      adapterIdRaw === 'gemini'
        ? adapterIdRaw
        : 'ollama'
    const mode: 'local' | 'cloud' =
      adapterId === 'openai' || adapterId === 'anthropic' || adapterId === 'gemini' ? 'cloud' : 'local'

    const model = typeof cfgRaw?.model === 'string' && cfgRaw.model.trim().length ? cfgRaw.model : 'llama3:8b'
    const endpoint = typeof cfgRaw?.endpoint === 'string' && cfgRaw.endpoint.trim().length ? cfgRaw.endpoint : undefined
    const cloudWarnBeforeSending =
      typeof cfgRaw?.cloudWarnBeforeSending === 'boolean' ? cfgRaw.cloudWarnBeforeSending : undefined

    await state.store.create({ profileId, name })
    await state.store.update(profileId, current => {
      return {
        ...current,
        updatedAt: Date.now(),
        name,
        setupComplete,
        trust: {
          ...current.trust,
          defaultTrustLevel: trustLevel,
        },
        llm: {
          ...current.llm,
          mode,
          adapterId,
          model,
          endpoint,
          cloudWarnBeforeSending,
        },
      }
    })
  }

  await writeLegacyMigrationMarker(state.profileRoot, { legacyProfilesRoot: legacyRootResolved, completedAt: Date.now() })
  return legacyActiveId
}
