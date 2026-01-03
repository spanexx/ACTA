import type { PermissionDecisionSource } from './types'

export const PHASE1_DECISION_PRIORITY: PermissionDecisionSource[] = [
  'hard-block',
  'rule',
  'tool-default',
  'domain-default',
  'profile-default',
]

export type Phase1ScopeMatchMode = 'prefix'
export const PHASE1_SCOPE_MATCH_MODE: Phase1ScopeMatchMode = 'prefix'
