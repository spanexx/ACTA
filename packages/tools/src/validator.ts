// Tool manifest validator
// Ensures all tools have valid manifests before registration

import { ToolManifest, RiskLevel } from '@acta/core'
import { REQUIRED_FIELDS } from './validator/constants'
import {
  validateDescription,
  validateEntry,
  validateId,
  validateName,
  validatePermissions,
  validateReversible,
  validateRiskLevel,
  validateVersion,
} from './validator/field-validators'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class ToolValidator {
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

    for (const field of REQUIRED_FIELDS) {
      if (!(field in manifestObj)) {
        errors.push(`Missing required field: ${field}`)
      }
    }

    if ('id' in manifestObj) {
      const idErrors = validateId(manifestObj.id)
      errors.push(...idErrors)
    }

    if ('name' in manifestObj) {
      const nameErrors = validateName(manifestObj.name)
      errors.push(...nameErrors)
    }

    if ('version' in manifestObj) {
      const versionErrors = validateVersion(manifestObj.version)
      errors.push(...versionErrors)
    }

    if ('description' in manifestObj) {
      const descriptionErrors = validateDescription(manifestObj.description)
      errors.push(...descriptionErrors)
    }

    if ('permissions' in manifestObj) {
      const permissionsErrors = validatePermissions(manifestObj.permissions)
      errors.push(...permissionsErrors)
    }

    if ('riskLevel' in manifestObj) {
      const riskLevelErrors = validateRiskLevel(manifestObj.riskLevel)
      errors.push(...riskLevelErrors)
    }

    if ('reversible' in manifestObj) {
      const reversibleErrors = validateReversible(manifestObj.reversible)
      errors.push(...reversibleErrors)
    }

    if ('entry' in manifestObj) {
      const entryErrors = validateEntry(manifestObj.entry)
      errors.push(...entryErrors)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
