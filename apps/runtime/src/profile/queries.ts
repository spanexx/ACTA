/*
 * Code Map: Profile Queries
 * - Directory queries: getLogsDir/getMemoryDir/getTrustDir.
 * - Profile queries: getActiveProfile/getProfile/listProfiles.
 *
 * CID Index:
 * CID:queries-001 -> getLogsDir
 * CID:queries-002 -> getMemoryDir
 * CID:queries-003 -> getTrustDir
 * CID:queries-004 -> getActiveProfile
 * CID:queries-005 -> getProfile
 * CID:queries-006 -> listProfiles
 *
 * Lookup: rg -n "CID:queries-" apps/runtime/src/profile/queries.ts
 */

import type { Profile } from '@acta/profiles'

import type { ProfileServiceState } from './state'
import { resolveProfileScopedDir } from './paths'

// CID:queries-001 - Get Logs Dir
// Purpose: Returns the logs directory path for the resolved profile.
// Uses: state.store.read(), resolveProfileScopedDir(), profile.paths.logs
// Used by: ProfileServiceCore.getLogsDir(); runtime logging utilities
export async function getLogsDir(state: ProfileServiceState, profileId?: string): Promise<string> {
  const resolved = profileId ?? state.activeProfileId
  if (!resolved) throw new Error('No active profile')
  const profile = await state.store.read(resolved)
  return resolveProfileScopedDir(state.profileRoot, resolved, profile.paths.logs)
}

// CID:queries-002 - Get Memory Dir
// Purpose: Returns the memory directory path for the resolved profile.
// Uses: state.store.read(), resolveProfileScopedDir(), profile.paths.memory
// Used by: ProfileServiceCore.getMemoryDir(); memory persistence
export async function getMemoryDir(state: ProfileServiceState, profileId?: string): Promise<string> {
  const resolved = profileId ?? state.activeProfileId
  if (!resolved) throw new Error('No active profile')
  const profile = await state.store.read(resolved)
  return resolveProfileScopedDir(state.profileRoot, resolved, profile.paths.memory)
}

// CID:queries-003 - Get Trust Dir
// Purpose: Returns the trust directory path for the resolved profile.
// Uses: state.store.read(), resolveProfileScopedDir(), profile.paths.trust
// Used by: ProfileServiceCore.getTrustDir(); trust store
export async function getTrustDir(state: ProfileServiceState, profileId?: string): Promise<string> {
  const resolved = profileId ?? state.activeProfileId
  if (!resolved) throw new Error('No active profile')
  const profile = await state.store.read(resolved)
  return resolveProfileScopedDir(state.profileRoot, resolved, profile.paths.trust)
}

// CID:queries-004 - Get Active Profile
// Purpose: Returns the active profile document or null if none is active.
// Uses: state.activeProfileId, state.store.read()
// Used by: ProfileServiceCore.getActiveProfile()
export async function getActiveProfile(state: ProfileServiceState): Promise<Profile | null> {
  const id = state.activeProfileId
  if (!id) return null
  return await state.store.read(id)
}

// CID:queries-005 - Get Profile
// Purpose: Returns a profile document for the resolved profile id.
// Uses: state.store.read()
// Used by: ProfileServiceCore.getProfile()
export async function getProfile(state: ProfileServiceState, profileId?: string): Promise<Profile> {
  const resolved = profileId ?? state.activeProfileId
  if (!resolved) {
    throw new Error('No active profile')
  }
  return await state.store.read(resolved)
}

// CID:queries-006 - List Profiles
// Purpose: Lists all profiles in the store.
// Uses: state.store.list()
// Used by: ProfileServiceCore.list()
export async function listProfiles(state: ProfileServiceState): Promise<Profile[]> {
  return await state.store.list()
}
