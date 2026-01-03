/*
 * Code Map: Profile Module Types
 * - ProfileUpdatePatch: Patch shape used for profile updates.
 * - ActiveProfilePointer: Persisted pointer structure for activeProfile.json.
 *
 * CID Index:
 * CID:types-001 -> ProfileUpdatePatch
 * CID:types-002 -> ActiveProfilePointer
 *
 * Lookup: rg -n "CID:types-" apps/runtime/src/profile/types.ts
 */

import type { LLMProviderId, ProfileLLMRequestDefaults, TrustLevel } from '@acta/profiles'

// CID:types-001 - Profile Update Patch
// Purpose: Defines the patch shape accepted by profile update operations.
// Uses: TrustLevel, LLMProviderId, ProfileLLMRequestDefaults
// Used by: operations.ts updateProfile(); ProfileServiceCore.update(); exported from profile/index.ts
export type ProfileUpdatePatch = {
  name?: string
  setupComplete?: boolean
  trust?: {
    defaultTrustLevel?: TrustLevel
    tools?: Record<string, TrustLevel>
    domains?: Record<string, TrustLevel>
  }
  llm?: {
    mode?: 'local' | 'cloud'
    adapterId?: LLMProviderId
    model?: string
    baseUrl?: string
    endpoint?: string
    apiKey?: string
    headers?: Record<string, string>
    cloudWarnBeforeSending?: boolean
    defaults?: ProfileLLMRequestDefaults
  }
}

// CID:types-002 - Active Profile Pointer
// Purpose: Defines the JSON pointer stored in activeProfile.json.
// Uses: string profileId
// Used by: active-pointer.ts read/write
export type ActiveProfilePointer = {
  profileId: string
}
