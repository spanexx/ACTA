import type { RiskLevel } from '@acta/core'

export const REQUIRED_FIELDS = [
  'id',
  'name',
  'version',
  'description',
  'permissions',
  'riskLevel',
  'reversible',
  'entry',
] as const

export const VALID_RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high']

export const ID_PATTERN = /^[a-z][a-z0-9]*([.][a-z0-9]+)*$/

export const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/
