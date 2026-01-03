/*
 * Code Map: Trust Can Execute API
 * - canExecute: Public API to evaluate permission and log decision
 *
 * CID Index:
 * CID:trust-can-execute-001 -> canExecute function
 *
 * Quick lookup: rg -n "CID:trust-can-execute-" /home/spanexx/Shared/Projects/ACTA/packages/trust/src/can-execute.ts
 */

import type { Logger } from '@acta/logging'

import type { PermissionDecision, PermissionRequest, TrustEvaluationOptions, TrustProfile } from './types'
import { evaluatePermission } from './evaluator'

/**
 * Agent-facing API: check if a step can execute.
 * Returns a decision (deny/ask/allow) and audits the decision via logging.
 */
// CID:trust-can-execute-001 - canExecute
// Purpose: Evaluate permission request via evaluator and emit audit log if logger provided
export async function canExecute(
  request: PermissionRequest,
  profile?: TrustProfile | null,
  logger?: Logger,
  options?: TrustEvaluationOptions,
): Promise<PermissionDecision> {
  const decision = evaluatePermission(request, profile, options)

  if (logger) {
    logger.info('permission:decision', {
      requestId: request.id,
      tool: request.tool,
      domain: request.domain,
      action: request.action,
      scope: request.scope,
      decision: decision.decision,
      trustLevel: decision.trustLevel,
      reason: decision.reason,
      source: decision.source,
    })
  }

  return decision
}
