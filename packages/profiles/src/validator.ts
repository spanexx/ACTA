import type { Profile } from './profile'
import { assertValidProfile } from './profile'

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

export function parseProfile(input: unknown): Profile {
  const normalized = normalizeProfile(input)
  assertValidProfile(normalized)
  return normalized as Profile
}
