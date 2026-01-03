export { TRUST_VERSION } from './version'

export {
  type TrustLevel,
  type RiskLevel,
  type PermissionDecisionSource,
  type TrustProfile,
  type TrustRule,
  type HardBlockConfig,
  type TrustEvaluationOptions,
  type PermissionRequest,
  type PermissionDecisionType,
  type PermissionDecision,
} from './types'

export { PHASE1_DECISION_PRIORITY, PHASE1_SCOPE_MATCH_MODE, type Phase1ScopeMatchMode } from './phase1'

export { RuleStore } from './rule-store'
export { TrustEngine } from './trust-engine'

export { evaluatePermission } from './evaluator'
export { canExecute } from './can-execute'
