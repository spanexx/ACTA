/*
 * Code Map: Profile Operations
 * - createProfile(): Creates a profile (and sets active profile if none).
 * - deleteProfile(): Deletes/archives profile and updates active pointer if needed.
 * - switchProfile(): Switches active profile and updates pointer.
 * - updateProfile(): Applies patch to profile document.
 *
 * CID Index:
 * CID:operations-001 -> createProfile
 * CID:operations-002 -> deleteProfile
 * CID:operations-003 -> switchProfile
 * CID:operations-004 -> updateProfile
 *
 * Lookup: rg -n "CID:operations-" apps/runtime/src/profile/operations.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import type { Profile } from '@acta/profiles'

import type { ProfileServiceState } from './state'
import type { ProfileUpdatePatch } from './types'
import { activePointerPath, withActiveLock, writeActivePointer } from './active-pointer'
import { refreshActiveDirs } from './active-dirs'
import { resolveSafeProfileDir } from './paths'

export async function createProfile(
  state: ProfileServiceState,
  opts: { name: string; profileId?: string },
): Promise<Profile> {
  // CID:operations-001 - Create Profile
  // Purpose: Creates a profile in the store and initializes activeProfileId if not already set.
  // Uses: state.store.create(), withActiveLock(), writeActivePointer(), refreshActiveDirs()
  // Used by: ProfileServiceCore.create()
  const profile = await state.store.create({ name: opts.name, profileId: opts.profileId })

  await withActiveLock(state.profileRoot, async () => {
    if (!state.activeProfileId) {
      state.activeProfileId = profile.id
      await writeActivePointer(state.profileRoot, profile.id)
    }
  })

  await refreshActiveDirs(state).catch(() => undefined)

  return profile
}

export async function deleteProfile(
  state: ProfileServiceState,
  profileId: string,
  opts?: { deleteFiles?: boolean },
): Promise<void> {
  // CID:operations-002 - Delete Profile
  // Purpose: Deletes or archives a profile and re-points activeProfileId if the active profile was removed.
  // Uses: resolveSafeProfileDir(), state.store.delete(), fs.rename/unlink, withActiveLock(), writeActivePointer(), refreshActiveDirs()
  // Used by: ProfileServiceCore.delete()
  const deleteFiles = opts?.deleteFiles ?? false
  const { root, dir } = resolveSafeProfileDir(state.profileRoot, profileId)

  if (deleteFiles) {
    await state.store.delete(profileId)
  } else {
    const trashDir = path.join(root, '.trash')
    await fs.mkdir(trashDir, { recursive: true })
    const dest = path.join(trashDir, `${profileId}-${Date.now()}`)
    await fs.rename(dir, dest)
  }

  await withActiveLock(state.profileRoot, async () => {
    if (state.activeProfileId === profileId) {
      const remaining = await state.store.list()
      const next = remaining[0]?.id ?? null
      state.activeProfileId = next
      if (next) {
        await writeActivePointer(state.profileRoot, next)
      } else {
        await fs.unlink(activePointerPath(state.profileRoot)).catch(() => undefined)
      }
    }
  })

  await refreshActiveDirs(state).catch(() => undefined)
}

export async function switchProfile(state: ProfileServiceState, profileId: string): Promise<Profile> {
  // CID:operations-003 - Switch Profile
  // Purpose: Sets activeProfileId to the given id and persists the active pointer.
  // Uses: state.store.read(), withActiveLock(), writeActivePointer(), refreshActiveDirs()
  // Used by: ProfileServiceCore.switch()
  const profile = await state.store.read(profileId)

  await withActiveLock(state.profileRoot, async () => {
    state.activeProfileId = profileId
    await writeActivePointer(state.profileRoot, profileId)
  })

  await refreshActiveDirs(state).catch(() => undefined)

  return profile
}

export async function updateProfile(
  state: ProfileServiceState,
  profileId: string,
  patch: ProfileUpdatePatch,
): Promise<Profile> {
  // CID:operations-004 - Update Profile
  // Purpose: Updates a profile document using a patch (trust + llm + meta fields) and refreshes active dirs.
  // Uses: state.store.update(), refreshActiveDirs()
  // Used by: ProfileServiceCore.update()
  const updated = await state.store.update(profileId, current => {
    const nextTrust = {
      ...current.trust,
      ...(patch.trust?.tools ? { tools: patch.trust.tools } : {}),
      ...(patch.trust?.domains ? { domains: patch.trust.domains } : {}),
    }

    if (patch.trust?.defaultTrustLevel !== undefined) {
      nextTrust.defaultTrustLevel = patch.trust.defaultTrustLevel
    }

    const nextLlm = {
      ...current.llm,
      ...(patch.llm ?? {}),
    }

    const next: Profile = {
      ...current,
      updatedAt: Date.now(),
      name: patch.name ?? current.name,
      setupComplete: patch.setupComplete ?? current.setupComplete,
      trust: nextTrust,
      llm: nextLlm,
    }

    return next
  })

  await refreshActiveDirs(state).catch(() => undefined)
  return updated
}
