/*
 * Code Map: Profile Service Initialization
 * - initProfileService(): Establishes the initial active profile id and persists activeProfile.json.
 * - Handles legacy migration and refreshes active directory cache.
 *
 * CID Index:
 * CID:init-001 -> initProfileService
 *
 * Lookup: rg -n "CID:init-" apps/runtime/src/profile/init.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import { loadConfig } from '@acta/core'

import type { ProfileServiceState } from './state'
import { readActivePointer, withActiveLock, writeActivePointer } from './active-pointer'
import { maybeMigrateLegacyProfiles } from './legacy/migrate'
import { refreshActiveDirs } from './active-dirs'

// CID:init-001 - Initialize Profile Service
// Purpose: Ensures state.activeProfileId is set, creating or selecting an existing profile and persisting the active pointer.
// Uses: loadConfig(), ActiveProfilePointer helpers, ProfileStore (via state.store), legacy migration, refreshActiveDirs()
// Used by: ProfileServiceCore.init(); runtime profile service bootstrap
export async function initProfileService(state: ProfileServiceState): Promise<void> {
  if (state.activeProfileId) return
  await fs.mkdir(path.resolve(state.profileRoot), { recursive: true })

  const cfg = loadConfig()
  const desiredDefaultId = (cfg.profileId ?? 'default').toLowerCase()

  await withActiveLock(state.profileRoot, async () => {
    const pointer = await readActivePointer(state.profileRoot)
    if (pointer) {
      try {
        await state.store.read(pointer.profileId)
        state.activeProfileId = pointer.profileId
        return
      } catch {
      }
    }

    const legacyActiveId = await maybeMigrateLegacyProfiles(state).catch(() => null)

    const existing = await state.store.list()
    if (existing.length) {
      if (legacyActiveId) {
        try {
          await state.store.read(legacyActiveId)
          state.activeProfileId = legacyActiveId
          await writeActivePointer(state.profileRoot, state.activeProfileId)
          return
        } catch {
        }
      }

      state.activeProfileId = existing[0].id
      await writeActivePointer(state.profileRoot, state.activeProfileId)
      return
    }

    const created = await state.store.create({
      profileId: desiredDefaultId,
      name: 'Default',
    })
    state.activeProfileId = created.id
    await writeActivePointer(state.profileRoot, created.id)
  })

  await refreshActiveDirs(state).catch(() => undefined)
}
