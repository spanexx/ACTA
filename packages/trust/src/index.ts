// Trust package scaffold (Phase-1)
export const TRUST_VERSION = "0.1.0"

import { createLogger, type Logger } from '@acta/logging'

// Numeric trust levels aligned with Vision-Skeleton schema (0-4)
export type TrustLevel = 0 | 1 | 2 | 3 | 4

// Basic risk levels used to drive stub evaluation
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface TrustProfile {
  profileId: string
  defaultTrustLevel: TrustLevel
  modes?: {
    instruction?: TrustLevel
    suggestive?: TrustLevel
    autonomous?: TrustLevel
  }
  domains?: Record<string, TrustLevel>
  tools?: Record<string, TrustLevel>
}

export interface PermissionRequest {
  id: string
  tool: string
  action: string
  reason: string
  scope?: string
  risk: RiskLevel
  reversible: boolean
  timestamp: number
  profileId: string
  userId?: string
  context?: unknown
}

export type PermissionDecisionType = 'deny' | 'ask' | 'allow'

export interface PermissionDecision {
  requestId: string
  decision: PermissionDecisionType
  trustLevel: TrustLevel
  reason?: string
}

// Phase-1 stub evaluator: always safe, never executes tools.
// For now, low-risk requests are allowed, everything else requires asking.
export function evaluatePermission(
  request: PermissionRequest,
  profile?: TrustProfile | null,
): PermissionDecision {
  const baseLevel: TrustLevel = (profile?.defaultTrustLevel ?? 2) as TrustLevel

  let decision: PermissionDecisionType
  let level: TrustLevel

  if (request.risk === 'low') {
    decision = 'allow'
    level = (baseLevel >= 2 ? baseLevel : 2) as TrustLevel
  } else if (request.risk === 'medium') {
    decision = 'ask'
    level = (baseLevel >= 1 ? baseLevel : 1) as TrustLevel
  } else {
    decision = 'ask'
    level = 1
  }

  return {
    requestId: request.id,
    decision,
    trustLevel: level,
    reason: 'phase-1 stub evaluation',
  }
}

/**
 * Agent-facing API: check if a step can execute.
 * Returns a decision (deny/ask/allow) and audits the decision via logging.
 */
export async function canExecute(
  request: PermissionRequest,
  profile?: TrustProfile | null,
  logger?: Logger,
): Promise<PermissionDecision> {
  const decision = evaluatePermission(request, profile)

  if (logger) {
    logger.info('permission:decision', {
      requestId: request.id,
      tool: request.tool,
      action: request.action,
      decision: decision.decision,
      trustLevel: decision.trustLevel,
      reason: decision.reason,
    })
  }

  return decision
}
