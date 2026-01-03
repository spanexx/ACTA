/*
 * Code Map: Profile Module Barrel
 * - Re-exports profile types, validation helpers, and factory functions.
 *
 * CID Index:
 * CID:profile-barrel-001 -> type exports
 * CID:profile-barrel-002 -> validation exports
 * CID:profile-barrel-003 -> factory export
 *
 * Lookup: rg -n "CID:profile-barrel-" packages/profiles/src/profile.ts
 */

export {
  PROFILE_SCHEMA_VERSION,
  type LLMProviderId,
  type LLMProviderMode,
  type Profile,
  type ProfileLLMConfig,
  type ProfileLLMRequestDefaults,
  type ProfilePaths,
  type ProfileSchemaVersion,
  type ProfileTrustDefaults,
  type TrustLevel,
  type ValidationResult,
} from './profile-types'

export { validateProfile, assertValidProfile } from './profile-validation'

export { createDefaultProfile, type CreateDefaultProfileParams } from './profile-factory'
