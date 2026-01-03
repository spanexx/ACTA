export const PROFILE_SCHEMA_VERSION = 1 as const

export type ProfileSchemaVersion = typeof PROFILE_SCHEMA_VERSION

export type TrustLevel = 0 | 1 | 2 | 3 | 4

export interface ProfileTrustDefaults {
  defaultTrustLevel: TrustLevel
  tools?: Record<string, TrustLevel>
  domains?: Record<string, TrustLevel>
}

export type LLMProviderMode = 'local' | 'cloud'

export type LLMProviderId = 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'gemini'

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

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

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

  const obj = value as Record<string, unknown>
  if (obj.temperature !== undefined) {
    if (typeof obj.temperature !== 'number' || !Number.isFinite(obj.temperature)) {
      errors.push('llm.defaults.temperature must be a number')
    } else if (obj.temperature < 0 || obj.temperature > 2) {
      errors.push('llm.defaults.temperature must be between 0 and 2')
    }
  }

  if (obj.maxTokens !== undefined) {
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
    const trust = obj.trust as Record<string, unknown>
    if (!isValidTrustLevel(trust.defaultTrustLevel)) {
      errors.push('trust.defaultTrustLevel must be a trust level (0-4)')
    }
    validateTrustMap(trust.tools, 'trust.tools', errors)
    validateTrustMap(trust.domains, 'trust.domains', errors)
  }

  if (!isPlainObject(obj.llm)) {
    errors.push('Missing llm')
  } else {
    const llm = obj.llm as Record<string, unknown>
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
    const paths = obj.paths as Record<string, unknown>
    for (const key of ['logs', 'memory', 'trust'] as const) {
      const v = paths[key]
      if (typeof v !== 'string' || !isSafeRelativePath(v)) {
        errors.push(`paths.${key} must be a safe relative path`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function assertValidProfile(input: unknown): asserts input is Profile {
  const result = validateProfile(input)
  if (!result.valid) {
    throw new Error(`Invalid profile:\n${result.errors.map(e => `  - ${e}`).join('\n')}`)
  }
}

export function createDefaultProfile(params: {
  id: string
  name: string
  now?: number
  trust?: Partial<ProfileTrustDefaults>
  llm?: Partial<ProfileLLMConfig>
  paths?: Partial<ProfilePaths>
}): Profile {
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
