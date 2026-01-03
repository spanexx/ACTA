/*
 * Code Map: Profile Factory
 * - createDefaultProfile(): Builds a default profile with overrides and validates it.
 *
 * CID Index:
 * CID:profile-factory-001 -> createDefaultProfile
 *
 * Lookup: rg -n "CID:profile-factory-" packages/profiles/src/profile-factory.ts
 */

import type { Profile, ProfileLLMConfig, ProfilePaths, ProfileTrustDefaults } from './profile-types'
import { PROFILE_SCHEMA_VERSION } from './profile-types'
import { assertValidProfile } from './profile-validation'

export interface CreateDefaultProfileParams {
  id: string
  name: string
  now?: number
  trust?: Partial<ProfileTrustDefaults>
  llm?: Partial<ProfileLLMConfig>
  paths?: Partial<ProfilePaths>
}

// CID:profile-factory-001 - createDefaultProfile
// Purpose: Creates a profile with default trust/LLM/path values, applies overrides, and validates the result.
// Uses: PROFILE_SCHEMA_VERSION constant, assertValidProfile()
// Used by: ProfileStore initialization and profile service bootstrap
export function createDefaultProfile(params: CreateDefaultProfileParams): Profile {
  const now = params.now ?? Date.now()

  const profile: Profile = {
    id: params.id,
    name: params.name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    setupComplete: false,
    trust: {
      defaultTrustLevel: 2,
      ...params.trust,
    },
    llm: {
      mode: 'local',
      adapterId: 'ollama',
      model: 'llama3:8b',
      baseUrl: 'http://localhost:11434',
      endpoint: 'http://localhost:11434',
      cloudWarnBeforeSending: true,
      ...params.llm,
    },
    paths: {
      logs: 'logs',
      memory: 'memory',
      trust: 'trust',
      ...params.paths,
    },
  }

  assertValidProfile(profile)
  return profile
}
