/**
 * Code Map: Profile Service State Management
 * - Defines ProfileServiceState type for service state structure
 * - Provides createProfileServiceState factory function
 * 
 * CID Index:
 * CID:profile-state-001 -> ProfileServiceState type
 * CID:profile-state-002 -> createProfileServiceState factory
 * 
 * Lookup: rg -n "CID:profile-state-" apps/runtime/src/profile/state.ts
 */

import { loadConfig } from '@acta/core'
import { ProfileStore } from '@acta/profiles'

/**
 * CID:profile-state-001 - ProfileServiceState Type Definition
 * Purpose: Defines the structure for profile service state management
 * Uses: ProfileStore from @acta/profiles
 * Used by: ProfileServiceCore, profile operations, legacy migration
 */
export type ProfileServiceState = {
  profileRoot: string
  store: ProfileStore
  activeProfileId: string | null
  activeLogsDir: string | null
  activeMemoryDir: string | null
}

/**
 * CID:profile-state-002 - createProfileServiceState Factory
 * Purpose: Creates initialized ProfileServiceState instances
 * Uses: loadConfig from @acta/core, ProfileStore constructor
 * Used by: ProfileService constructor, profile module exports
 */
export function createProfileServiceState(profileRoot?: string): ProfileServiceState {
  const cfg = loadConfig()
  const resolvedRoot = profileRoot ?? cfg.profileRoot

  return {
    profileRoot: resolvedRoot,
    store: new ProfileStore(resolvedRoot),
    activeProfileId: null,
    activeLogsDir: null,
    activeMemoryDir: null,
  }
}
