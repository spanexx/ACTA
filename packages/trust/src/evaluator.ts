/*
 * Code Map: Trust Evaluator
 * - decisionFromRiskAndTrustLevel: Map risk/trust to allow/ask
 * - evaluatePermission: Phase-1 evaluation pipeline with hard blocks, rules, defaults
 *
 * CID Index:
 * CID:trust-evaluator-001 -> decisionFromRiskAndTrustLevel
 * CID:trust-evaluator-002 -> evaluatePermission
 *
 * Quick lookup: rg -n "CID:trust-evaluator-" /home/spanexx/Shared/Projects/ACTA/packages/trust/src/evaluator.ts
 */

import type {
  PermissionDecision,
  PermissionDecisionType,
  PermissionRequest,
  RiskLevel,
  TrustEvaluationOptions,
  TrustLevel,
  TrustProfile,
} from './types'

import { findMatchingRule, inferDomain, isHardBlocked } from './internal/matching'

// CID:trust-evaluator-001 - decisionFromRiskAndTrustLevel
// Purpose: Convert risk/trust to a PermissionDecisionType for phase-1 algorithm
function decisionFromRiskAndTrustLevel(opts: { risk: RiskLevel; trustLevel: TrustLevel }): PermissionDecisionType {
  const { risk, trustLevel } = opts

  if (risk === 'low') return trustLevel >= 2 ? 'allow' : 'ask'
  if (risk === 'medium') return trustLevel >= 3 ? 'allow' : 'ask'
  if (risk === 'high') return trustLevel >= 4 ? 'allow' : 'ask'
  return 'ask'
}

// Phase-1 stub evaluator: always safe, never executes tools.
// For now, low-risk requests are allowed, everything else requires asking.
// CID:trust-evaluator-002 - evaluatePermission
// Purpose: Apply hard blocks -> remembered rules -> tool/domain defaults -> profile default
// Used by: canExecute, trust engine
export function evaluatePermission(
  request: PermissionRequest,
  profile?: TrustProfile | null,
  options?: TrustEvaluationOptions,
): PermissionDecision {
  const hardBlocked = isHardBlocked(request, options?.hardBlock)
  if (hardBlocked) {
    return {
      requestId: request.id,
      decision: 'deny',
      trustLevel: 0,
      reason: hardBlocked.reason,
      source: 'hard-block',
    }
  }

  const matchingRule = findMatchingRule(request, options?.rules)
  if (matchingRule) {
    return {
      requestId: request.id,
      decision: matchingRule.decision,
      trustLevel: (profile?.defaultTrustLevel ?? 2) as TrustLevel,
      reason: `rule:${matchingRule.id}`,
      source: 'rule',
    }
  }

  const baseLevel: TrustLevel = (profile?.defaultTrustLevel ?? 2) as TrustLevel
  const domain = inferDomain(request)

  const toolDefault = profile?.tools?.[request.tool]
  if (typeof toolDefault === 'number') {
    const decision = decisionFromRiskAndTrustLevel({ risk: request.risk, trustLevel: toolDefault })
    return {
      requestId: request.id,
      decision,
      trustLevel: toolDefault,
      reason: 'phase-1 evaluation (tool default)',
      source: 'tool-default',
    }
  }

  const domainDefault = domain ? profile?.domains?.[domain] : undefined
  if (typeof domainDefault === 'number') {
    const decision = decisionFromRiskAndTrustLevel({ risk: request.risk, trustLevel: domainDefault })
    return {
      requestId: request.id,
      decision,
      trustLevel: domainDefault,
      reason: 'phase-1 evaluation (domain default)',
      source: 'domain-default',
    }
  }

  const decision = decisionFromRiskAndTrustLevel({ risk: request.risk, trustLevel: baseLevel })

  return {
    requestId: request.id,
    decision,
    trustLevel: baseLevel,
    reason: 'phase-1 evaluation (profile default)',
    source: 'profile-default',
  }
}
