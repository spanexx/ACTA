/*
 * Code Map: Profile Types & Constants
 * - Schema/version constants.
 * - Core profile domain types (trust/LLM/paths/profile data).
 * - Validation result interface used by validators.
 *
 * CID Index:
 * CID:profile-types-001 -> PROFILE_SCHEMA_VERSION
 * CID:profile-types-002 -> Primitive enums (TrustLevel/LLM providers)
 * CID:profile-types-003 -> Profile configuration interfaces
 * CID:profile-types-004 -> ValidationResult
 *
 * Lookup: rg -n "CID:profile-types-" packages/profiles/src/profile-types.ts
 */

// CID:profile-types-001 - Schema Version Constant
// Purpose: Defines the profile schema version used for compatibility validation.
// Uses: Literal const assertion
// Used by: Validation logic and default profile factory
export const PROFILE_SCHEMA_VERSION = 1 as const

export type ProfileSchemaVersion = typeof PROFILE_SCHEMA_VERSION

// CID:profile-types-002 - Primitive Enums
// Purpose: Enumerates trust levels, LLM provider modes/ids used across the module.
// Uses: Literal unions
// Used by: Profile trust/LLM config definitions, validation helpers
export type TrustLevel = 0 | 1 | 2 | 3 | 4

export type LLMProviderMode = 'local' | 'cloud'

export type LLMProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini'

// CID:profile-types-003 - Profile Configuration Interfaces
// Purpose: Defines structured shape for trust defaults, LLM configuration, paths, and the Profile object.
// Uses: Primitive enums above
// Used by: Validation + factory logic throughout the package
export interface ProfileTrustDefaults {
  defaultTrustLevel: TrustLevel
  tools?: Record<string, TrustLevel>
  domains?: Record<string, TrustLevel>
}

export interface ProfileLLMRequestDefaults {
  temperature?: number
  maxTokens?: number
}

export interface ProfileLLMConfig {
  mode: LLMProviderMode
  adapterId: LLMProviderId
  model: string
  baseUrl?: string
  endpoint?: string
  cloudWarnBeforeSending?: boolean
  defaults?: ProfileLLMRequestDefaults
}

export interface ProfilePaths {
  logs: string
  memory: string
  trust: string
}

export interface Profile {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  schemaVersion: ProfileSchemaVersion
  setupComplete: boolean
  trust: ProfileTrustDefaults
  llm: ProfileLLMConfig
  paths: ProfilePaths
}

// CID:profile-types-004 - Validation Result
// Purpose: Shared result structure returned by validateProfile().
// Uses: Simple boolean/string[] fields
// Used by: profile-validation + consumers that inspect validation errors
export interface ValidationResult {
  valid: boolean
  errors: string[]
}
