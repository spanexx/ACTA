import type { RiskLevel } from '@acta/core'
import { ID_PATTERN, VALID_RISK_LEVELS, VERSION_PATTERN } from './constants'

export function validateId(id: unknown): string[] {
  const errors: string[] = []

  if (typeof id !== 'string') {
    errors.push('id must be a string')
    return errors
  }

  if (id.length === 0) {
    errors.push('id cannot be empty')
  }

  if (id.length > 100) {
    errors.push('id cannot exceed 100 characters')
  }

  if (!ID_PATTERN.test(id)) {
    errors.push('id must match pattern: lowercase alphanumeric with dots, starting with letter')
  }

  return errors
}

export function validateName(name: unknown): string[] {
  const errors: string[] = []

  if (typeof name !== 'string') {
    errors.push('name must be a string')
    return errors
  }

  if (name.length === 0) {
    errors.push('name cannot be empty')
  }

  if (name.length > 200) {
    errors.push('name cannot exceed 200 characters')
  }

  return errors
}

export function validateVersion(version: unknown): string[] {
  const errors: string[] = []

  if (typeof version !== 'string') {
    errors.push('version must be a string')
    return errors
  }

  if (!VERSION_PATTERN.test(version)) {
    errors.push('version must follow semantic versioning (e.g., 1.0.0)')
  }

  return errors
}

export function validateDescription(description: unknown): string[] {
  const errors: string[] = []

  if (typeof description !== 'string') {
    errors.push('description must be a string')
    return errors
  }

  if (description.length === 0) {
    errors.push('description cannot be empty')
  }

  if (description.length > 1000) {
    errors.push('description cannot exceed 1000 characters')
  }

  return errors
}

export function validatePermissions(permissions: unknown): string[] {
  const errors: string[] = []

  if (!permissions || typeof permissions !== 'object') {
    errors.push('permissions must be an object')
    return errors
  }

  const permObj = permissions as Record<string, unknown>

  if (!('read' in permObj)) {
    errors.push('permissions must include "read" field')
  } else if (typeof permObj.read !== 'boolean') {
    errors.push('permissions.read must be a boolean')
  }

  if (!('write' in permObj)) {
    errors.push('permissions must include "write" field')
  } else if (typeof permObj.write !== 'boolean') {
    errors.push('permissions.write must be a boolean')
  }

  if (!('execute' in permObj)) {
    errors.push('permissions must include "execute" field')
  } else if (typeof permObj.execute !== 'boolean') {
    errors.push('permissions.execute must be a boolean')
  }

  return errors
}

export function validateRiskLevel(riskLevel: unknown): string[] {
  const errors: string[] = []

  if (typeof riskLevel !== 'string') {
    errors.push('riskLevel must be a string')
    return errors
  }

  if (!VALID_RISK_LEVELS.includes(riskLevel as RiskLevel)) {
    errors.push(`riskLevel must be one of: ${VALID_RISK_LEVELS.join(', ')}`)
  }

  return errors
}

export function validateReversible(reversible: unknown): string[] {
  const errors: string[] = []

  if (typeof reversible !== 'boolean') {
    errors.push('reversible must be a boolean')
  }

  return errors
}

export function validateEntry(entry: unknown): string[] {
  const errors: string[] = []

  if (typeof entry !== 'string') {
    errors.push('entry must be a string')
    return errors
  }

  if (entry.length === 0) {
    errors.push('entry cannot be empty')
  }

  if (entry.length > 255) {
    errors.push('entry cannot exceed 255 characters')
  }

  return errors
}
