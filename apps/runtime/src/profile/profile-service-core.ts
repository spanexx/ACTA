/*
 * Code Map: ProfileServiceCore
 * - Thin orchestrator around profile state, init, queries, and operations.
 * - Exposes a small imperative API for the runtime to manage profiles.
 *
 * CID Index:
 * CID:profile-service-core-001 -> ProfileServiceCore (class)
 * CID:profile-service-core-002 -> init
 * CID:profile-service-core-003 -> getters (active id + cached dirs)
 * CID:profile-service-core-004 -> directory queries (getLogsDir/getMemoryDir/getTrustDir)
 * CID:profile-service-core-005 -> profile queries (getActiveProfile/getProfile/list)
 * CID:profile-service-core-006 -> operations (create/delete/switch/update)
 *
 * Lookup: rg -n "CID:profile-service-core-" apps/runtime/src/profile/profile-service-core.ts
 */

import type { Profile } from '@acta/profiles'

import type { ProfileServiceState } from './state'
import type { ProfileUpdatePatch } from './types'
import { initProfileService } from './init'
import { createProfile, deleteProfile, switchProfile, updateProfile } from './operations'
import { getActiveProfile, getLogsDir, getMemoryDir, getProfile, getTrustDir, listProfiles } from './queries'

// CID:profile-service-core-001 - ProfileServiceCore
// Purpose: Central API surface for profile management inside the runtime.
// Uses: ProfileServiceState, init/operations/queries modules
// Used by: apps/runtime/src/profile.service.ts and other runtime subsystems
export class ProfileServiceCore {
  constructor(private readonly state: ProfileServiceState) {}

  // CID:profile-service-core-002 - Initialization
  // Purpose: Initializes active profile selection and active directory cache.
  // Uses: initProfileService()
  // Used by: Runtime startup
  async init(): Promise<void> {
    await initProfileService(this.state)
  }

  // CID:profile-service-core-003 - Cached Getters
  // Purpose: Exposes cached active ids/dirs stored on state.
  // Uses: ProfileServiceState
  // Used by: Runtime code needing current active dirs
  getActiveProfileId(): string | null {
    return this.state.activeProfileId
  }

  getActiveLogsDir(): string | null {
    return this.state.activeLogsDir
  }

  getActiveMemoryDir(): string | null {
    return this.state.activeMemoryDir
  }

  // CID:profile-service-core-004 - Directory Queries
  // Purpose: Provides async directory lookups for logs/memory/trust.
  // Uses: queries.ts helpers
  // Used by: Runtime subsystems that need per-profile directories
  async getLogsDir(profileId?: string): Promise<string> {
    return await getLogsDir(this.state, profileId)
  }

  async getMemoryDir(profileId?: string): Promise<string> {
    return await getMemoryDir(this.state, profileId)
  }

  async getTrustDir(profileId?: string): Promise<string> {
    return await getTrustDir(this.state, profileId)
  }

  // CID:profile-service-core-005 - Profile Queries
  // Purpose: Provides access to profiles as stored documents.
  // Uses: queries.ts helpers
  // Used by: Runtime UI/API layer
  async getActiveProfile(): Promise<Profile | null> {
    return await getActiveProfile(this.state)
  }

  async getProfile(profileId?: string): Promise<Profile> {
    return await getProfile(this.state, profileId)
  }

  async list(): Promise<Profile[]> {
    return await listProfiles(this.state)
  }

  // CID:profile-service-core-006 - Profile Operations
  // Purpose: Provides profile create/delete/switch/update operations.
  // Uses: operations.ts helpers
  // Used by: Runtime UI/API layer
  async create(opts: { name: string; profileId?: string }): Promise<Profile> {
    return await createProfile(this.state, opts)
  }

  async delete(profileId: string, opts?: { deleteFiles?: boolean }): Promise<void> {
    await deleteProfile(this.state, profileId, opts)
  }

  async switch(profileId: string): Promise<Profile> {
    return await switchProfile(this.state, profileId)
  }

  async update(profileId: string, patch: ProfileUpdatePatch): Promise<Profile> {
    return await updateProfile(this.state, profileId, patch)
  }
}
