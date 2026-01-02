// Tool manifest validator
// Ensures all tools have valid manifests before registration

import { ToolManifest, RiskLevel } from '@acta/core'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class ToolValidator {
  private static readonly REQUIRED_FIELDS = [
    'id',
    'name',
    'version',
    'description',
    'permissions',
    'riskLevel',
    'reversible',
    'entry'
  ] as const

  private static readonly VALID_RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high']

  private static readonly ID_PATTERN = /^[a-z][a-z0-9]*([.][a-z0-9]+)*$/

  private static readonly VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/

  validateManifest(manifest: unknown): ToolManifest {
    const result = this.validate(manifest)
    
    if (!result.valid) {
      throw new Error(
        `Invalid tool manifest:\n${result.errors.map(e => `  - ${e}`).join('\n')}`
      )
    }
    
    return manifest as ToolManifest
  }

  validate(manifest: unknown): ValidationResult {
    const errors: string[] = []

    if (!manifest || typeof manifest !== 'object') {
      return {
        valid: false,
        errors: ['Manifest must be an object']
      }
    }

    const manifestObj = manifest as Record<string, unknown>

    for (const field of ToolValidator.REQUIRED_FIELDS) {
      if (!(field in manifestObj)) {
        errors.push(`Missing required field: ${field}`)
      }
    }

    if ('id' in manifestObj) {
      const idErrors = this.validateId(manifestObj.id)
      errors.push(...idErrors)
    }

    if ('name' in manifestObj) {
      const nameErrors = this.validateName(manifestObj.name)
      errors.push(...nameErrors)
    }

    if ('version' in manifestObj) {
      const versionErrors = this.validateVersion(manifestObj.version)
      errors.push(...versionErrors)
    }

    if ('description' in manifestObj) {
      const descriptionErrors = this.validateDescription(manifestObj.description)
      errors.push(...descriptionErrors)
    }

    if ('permissions' in manifestObj) {
      const permissionsErrors = this.validatePermissions(manifestObj.permissions)
      errors.push(...permissionsErrors)
    }

    if ('riskLevel' in manifestObj) {
      const riskLevelErrors = this.validateRiskLevel(manifestObj.riskLevel)
      errors.push(...riskLevelErrors)
    }

    if ('reversible' in manifestObj) {
      const reversibleErrors = this.validateReversible(manifestObj.reversible)
      errors.push(...reversibleErrors)
    }

    if ('entry' in manifestObj) {
      const entryErrors = this.validateEntry(manifestObj.entry)
      errors.push(...entryErrors)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private validateId(id: unknown): string[] {
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

    if (!ToolValidator.ID_PATTERN.test(id)) {
      errors.push(
        'id must match pattern: lowercase alphanumeric with dots, starting with letter'
      )
    }

    return errors
  }

  private validateName(name: unknown): string[] {
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

  private validateVersion(version: unknown): string[] {
    const errors: string[] = []

    if (typeof version !== 'string') {
      errors.push('version must be a string')
      return errors
    }

    if (!ToolValidator.VERSION_PATTERN.test(version)) {
      errors.push('version must follow semantic versioning (e.g., 1.0.0)')
    }

    return errors
  }

  private validateDescription(description: unknown): string[] {
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

  private validatePermissions(permissions: unknown): string[] {
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

  private validateRiskLevel(riskLevel: unknown): string[] {
    const errors: string[] = []

    if (typeof riskLevel !== 'string') {
      errors.push('riskLevel must be a string')
      return errors
    }

    if (!ToolValidator.VALID_RISK_LEVELS.includes(riskLevel as RiskLevel)) {
      errors.push(
        `riskLevel must be one of: ${ToolValidator.VALID_RISK_LEVELS.join(', ')}`
      )
    }

    return errors
  }

  private validateReversible(reversible: unknown): string[] {
    const errors: string[] = []

    if (typeof reversible !== 'boolean') {
      errors.push('reversible must be a boolean')
    }

    return errors
  }

  private validateEntry(entry: unknown): string[] {
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
}
