/*
 * Code Map: Profile Validator
 * - normalizeProfile(): Applies backward-compatible defaults to stored profiles.
 * - parseProfile(): Normalizes + validates profiles before returning typed Profile.
 *
 * CID Index:
 * CID:profiles-validator-001 -> normalizeProfile
 * CID:profiles-validator-002 -> parseProfile
 *
 * Lookup: rg -n "CID:profiles-validator-" packages/profiles/src/validator.ts
 */

import type { Profile } from './profile'
import { assertValidProfile } from './profile'

// CID:profiles-validator-001 - Normalize Profile
// Purpose: Normalizes legacy/missing fields before validation to maintain compatibility.
// Uses: default value assignments; ensures llm/baseUrl/endpoint + paths exist
// Used by: parseProfile()
function normalizeProfile(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input

  const obj: any = { ...(input as any) }

  if (typeof obj.setupComplete !== 'boolean') {
    obj.setupComplete = false
  }

  if (obj.llm && typeof obj.llm === 'object') {
    if (obj.llm.cloudWarnBeforeSending === undefined) {
      obj.llm.cloudWarnBeforeSending = true
    }
    if (obj.llm.baseUrl === undefined && typeof obj.llm.endpoint === 'string' && obj.llm.endpoint.trim().length) {
      obj.llm.baseUrl = obj.llm.endpoint
    }
    if (obj.llm.endpoint === undefined && typeof obj.llm.baseUrl === 'string' && obj.llm.baseUrl.trim().length) {
      obj.llm.endpoint = obj.llm.baseUrl
    }
    if (obj.llm.endpoint === undefined && obj.llm.adapterId === 'ollama') {
      obj.llm.endpoint = 'http://localhost:11434'
    }
    if (obj.llm.baseUrl === undefined && obj.llm.adapterId === 'ollama') {
      obj.llm.baseUrl = obj.llm.endpoint
    }
  }

  if (obj.paths && typeof obj.paths === 'object') {
    if (typeof obj.paths.logs !== 'string') obj.paths.logs = 'logs'
    if (typeof obj.paths.memory !== 'string') obj.paths.memory = 'memory'
    if (typeof obj.paths.trust !== 'string') obj.paths.trust = 'trust'
  }

  return obj
}

// CID:profiles-validator-002 - Parse Profile
// Purpose: Normalizes and validates profile JSON before returning a typed Profile object.
// Uses: normalizeProfile(), assertValidProfile()
// Used by: ProfileStore.read(), update(), list()
export function parseProfile(input: unknown): Profile {
  const normalized = normalizeProfile(input)
  assertValidProfile(normalized)
  return normalized as Profile
}
