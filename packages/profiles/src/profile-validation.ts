/*
 * Code Map: Profile Validation Helpers
 * - Utility predicates for IDs, paths, trust levels, provider ids.
 * - validateProfile(): Comprehensive schema validator.
 * - assertValidProfile(): Throws with aggregated errors.
 *
 * CID Index:
 * CID:profile-validation-001 -> Utility predicates
 * CID:profile-validation-002 -> validateProfile
 * CID:profile-validation-003 -> assertValidProfile
 *
 * Lookup: rg -n "CID:profile-validation-" packages/profiles/src/profile-validation.ts
 */

import {
  PROFILE_SCHEMA_VERSION,
  type LLMProviderId,
  type Profile,
  type ProfileLLMConfig,
  type ProfilePaths,
  type ProfileTrustDefaults,
  type TrustLevel,
  type ValidationResult,
} from './profile-types'

// CID:profile-validation-001 - Utility Predicates
// Purpose: Provide shared validation helpers reused across validation logic.
// Uses: Basic JS stdlib
// Used by: validateProfile()
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeRelativePath(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  if (value.startsWith('/') || value.startsWith('\\')) return false
  if (/^[a-zA-Z]:\\/.test(value)) return false
  if (value.includes('..')) return false
  return true
}

function isValidProfileId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-_]{2,63}$/.test(id)
}

function isValidProfileName(name: string): boolean {
  const n = name.trim()
  return n.length >= 1 && n.length <= 80
}

function isValidTrustLevel(level: unknown): level is TrustLevel {
  return level === 0 || level === 1 || level === 2 || level === 3 || level === 4
}

function isValidLlmProviderId(value: unknown): value is LLMProviderId {
  return value === 'ollama' || value === 'lmstudio' || value === 'openai' || value === 'anthropic' || value === 'gemini'
}

function validateLlmDefaults(value: unknown, errors: string[]): void {
  if (value === undefined) return
  if (!isPlainObject(value)) {
    errors.push('llm.defaults must be an object')
    return
  }

  const obj = value as ProfileLLMConfig['defaults'] & Record<string, unknown>
  if (obj?.temperature !== undefined) {
    if (typeof obj.temperature !== 'number' || !Number.isFinite(obj.temperature)) {
      errors.push('llm.defaults.temperature must be a number')
    } else if (obj.temperature < 0 || obj.temperature > 2) {
      errors.push('llm.defaults.temperature must be between 0 and 2')
    }
  }

  if (obj?.maxTokens !== undefined) {
    if (typeof obj.maxTokens !== 'number' || !Number.isFinite(obj.maxTokens)) {
      errors.push('llm.defaults.maxTokens must be a number')
    } else if (obj.maxTokens <= 0) {
      errors.push('llm.defaults.maxTokens must be > 0')
    }
  }
}

function validateTrustMap(map: unknown, label: string, errors: string[]): void {
  if (map === undefined) return
  if (!isPlainObject(map)) {
    errors.push(`${label} must be an object`)
    return
  }
  for (const [k, v] of Object.entries(map)) {
    if (typeof k !== 'string' || !k.trim()) {
      errors.push(`${label} contains invalid key`)
      continue
    }
    if (!isValidTrustLevel(v)) {
      errors.push(`${label}.${k} must be a trust level (0-4)`)
    }
  }
}

// CID:profile-validation-002 - validateProfile
// Purpose: Validates unknown input against the Profile schema and returns aggregated errors.
// Uses: Utility predicates above + PROFILE_SCHEMA_VERSION constant
// Used by: assertValidProfile(); profile factory; ProfileStore
export function validateProfile(input: unknown): ValidationResult {
  const errors: string[] = []

  if (!isPlainObject(input)) {
    return { valid: false, errors: ['Profile must be an object'] }
  }

  const obj = input as Record<string, unknown>

  if (typeof obj.id !== 'string' || !isValidProfileId(obj.id)) {
    errors.push('Invalid id')
  }

  if (typeof obj.name !== 'string' || !isValidProfileName(obj.name)) {
    errors.push('Invalid name')
  }

  if (typeof obj.createdAt !== 'number' || !Number.isFinite(obj.createdAt)) {
    errors.push('Invalid createdAt')
  }

  if (typeof obj.updatedAt !== 'number' || !Number.isFinite(obj.updatedAt)) {
    errors.push('Invalid updatedAt')
  }

  if (obj.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion (supported: ${PROFILE_SCHEMA_VERSION})`)
  }

  if (typeof obj.setupComplete !== 'boolean') {
    errors.push('Invalid setupComplete')
  }

  if (!isPlainObject(obj.trust)) {
    errors.push('Missing trust')
  } else {
    const trust = obj.trust as ProfileTrustDefaults & Record<string, unknown>
    if (!isValidTrustLevel(trust.defaultTrustLevel)) {
      errors.push('trust.defaultTrustLevel must be a trust level (0-4)')
    }
    validateTrustMap(trust.tools, 'trust.tools', errors)
    validateTrustMap(trust.domains, 'trust.domains', errors)
  }

  if (!isPlainObject(obj.llm)) {
    errors.push('Missing llm')
  } else {
    const llm = obj.llm as ProfileLLMConfig & Record<string, unknown>
    if (llm.mode !== 'local' && llm.mode !== 'cloud') {
      errors.push("llm.mode must be 'local' or 'cloud'")
    }
    if (!isValidLlmProviderId(llm.adapterId)) {
      errors.push("llm.adapterId must be one of: 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini'")
    }
    if (typeof llm.model !== 'string' || !llm.model.trim()) {
      errors.push('llm.model must be a non-empty string')
    }
    if (llm.baseUrl !== undefined && typeof llm.baseUrl !== 'string') {
      errors.push('llm.baseUrl must be a string')
    }
    if (llm.endpoint !== undefined && typeof llm.endpoint !== 'string') {
      errors.push('llm.endpoint must be a string')
    }
    if (llm.cloudWarnBeforeSending !== undefined && typeof llm.cloudWarnBeforeSending !== 'boolean') {
      errors.push('llm.cloudWarnBeforeSending must be a boolean')
    }

    validateLlmDefaults(llm.defaults, errors)

    if (llm.mode === 'local') {
      const hasBaseUrl = typeof llm.baseUrl === 'string' && llm.baseUrl.trim().length > 0
      const hasEndpoint = typeof llm.endpoint === 'string' && llm.endpoint.trim().length > 0
      if (!hasBaseUrl && !hasEndpoint) {
        errors.push('llm.baseUrl (or endpoint) is required for local providers')
      }
    }
  }

  if (!isPlainObject(obj.paths)) {
    errors.push('Missing paths')
  } else {
    const paths = obj.paths as ProfilePaths & Record<string, unknown>
    for (const key of ['logs', 'memory', 'trust'] as const) {
      const v = paths[key]
      if (typeof v !== 'string' || !isSafeRelativePath(v)) {
        errors.push(`paths.${key} must be a safe relative path`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// CID:profile-validation-003 - assertValidProfile
// Purpose: Asserts that an unknown profile passes validation; throws with detailed errors otherwise.
// Uses: validateProfile()
// Used by: profile factory and any caller needing hard guarantees
export function assertValidProfile(input: unknown): asserts input is Profile {
  const result = validateProfile(input)
  if (!result.valid) {
    throw new Error(`Invalid profile:\n${result.errors.map(e => `  - ${e}`).join('\n')}`)
  }
}
