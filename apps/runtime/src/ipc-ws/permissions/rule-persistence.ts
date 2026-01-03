/*
 * Code Map: Permission Rule Persistence
 * - inferScopePrefix: Extract directory prefix from request scope
 * - persistRememberedRule: Save permission decisions as persistent rules
 * 
 * CID Index:
 * CID:rule-persistence-001 -> inferScopePrefix
 * CID:rule-persistence-002 -> persistRememberedRule
 * 
 * Quick lookup: rg -n "CID:rule-persistence-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/rule-persistence.ts
 */

import { RuleStore, type PermissionDecisionType, type PermissionRequest, type TrustRule } from '@acta/trust'

import type { PermissionCoordinatorState } from './state'

// CID:rule-persistence-001 - inferScopePrefix
// Purpose: Extract directory prefix from request scope for rule matching
// Uses: String manipulation, path normalization
// Used by: persistRememberedRule for creating scoped rules
function inferScopePrefix(request: PermissionRequest): string | undefined {
  const requestScope = typeof request.scope === 'string' ? request.scope : undefined
  if (!requestScope) return undefined

  const normalized = requestScope.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx > 0 ? normalized.slice(0, idx + 1) : normalized
}

// CID:rule-persistence-002 - persistRememberedRule
// Purpose: Save permission decision as persistent trust rule for future auto-approval
// Uses: RuleStore, inferScopePrefix, TrustRule types
// Used by: Response handler for remembering user permission decisions
export async function persistRememberedRule(state: PermissionCoordinatorState, opts: {
  profileId?: string
  request: PermissionRequest
  decision: PermissionDecisionType
  remember: boolean
}): Promise<void> {
  if (!opts.remember) return
  if (!opts.profileId || !state.opts.getTrustDir) return
  if (opts.decision !== 'allow' && opts.decision !== 'deny') return

  try {
    const trustDir = await state.opts.getTrustDir(opts.profileId)
    const store = new RuleStore({ profileTrustDir: trustDir })

    const scopePrefix = inferScopePrefix(opts.request)

    const rule: Omit<TrustRule, 'id' | 'createdAt'> = {
      tool: opts.request.tool,
      scopePrefix,
      decision: opts.decision,
      remember: 'persistent',
    }

    const existingRules = await store.listRules()
    const existing = existingRules.find(r => r.tool === rule.tool && r.scopePrefix === rule.scopePrefix)
    if (existing) {
      await store.upsertRule({
        ...existing,
        decision: rule.decision,
        remember: rule.remember,
      })
    } else {
      await store.addRule(rule)
    }
  } catch {
    return
  }
}
