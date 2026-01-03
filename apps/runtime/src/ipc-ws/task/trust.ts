/*
 * Code Map: Trust Evaluation
 * - createTrustEvaluator: Creates permission evaluation function with audit logging
 * 
 * CID Index:
 * CID:trust-001 -> createTrustEvaluator
 * 
 * Quick lookup: rg -n "CID:trust-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/trust.ts
 */

import type { Logger } from '@acta/logging'
import { RuleStore, TrustEngine, type PermissionDecision, type PermissionRequest, type TrustProfile } from '@acta/trust'

import { appendAuditLog } from './audit'

// CID:trust-001 - createTrustEvaluator
// Purpose: Create trust evaluator function that logs permission decisions to audit
// Uses: TrustEngine, RuleStore, appendAuditLog for logging
// Used by: Task execution orchestrator for permission checks
export async function createTrustEvaluator(opts: {
  task: { correlationId: string; profileId: string }
  logger: Logger
  logsDir?: string
  trustDir?: string
  profile: TrustProfile
}): Promise<((request: PermissionRequest) => Promise<PermissionDecision>) | undefined> {
  if (!opts.trustDir) return undefined

  const store = new RuleStore({ profileTrustDir: opts.trustDir })
  const engine = new TrustEngine({ ruleStore: store })

  return async (request: PermissionRequest) => {
    const decision = await engine.canExecute(request, opts.profile, opts.logger)
    await appendAuditLog({
      logsDir: opts.logsDir,
      event: {
        type: 'permission.evaluate',
        timestamp: Date.now(),
        correlationId: opts.task.correlationId,
        profileId: opts.task.profileId,
        requestId: request.id,
        tool: request.tool,
        scope: request.scope,
        action: request.action,
        decision: decision.decision,
        source: decision.source,
        reason: decision.reason,
      },
    })
    return decision
  }
}
