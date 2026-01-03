/*
 * Code Map: Trust Matching Helpers
 * - inferDomain: Derive domain from request/tool
 * - matchesScopePrefix: Check scope prefix alignment
 * - findMatchingRule: Locate stored rule for request
 * - isHardBlocked: Evaluate hard block configuration
 *
 * CID Index:
 * CID:trust-matching-001 -> inferDomain
 * CID:trust-matching-002 -> matchesScopePrefix
 * CID:trust-matching-003 -> findMatchingRule
 * CID:trust-matching-004 -> isHardBlocked
 *
 * Quick lookup: rg -n "CID:trust-matching-" /home/spanexx/Shared/Projects/ACTA/packages/trust/src/internal/matching.ts
 */

import type { HardBlockConfig, PermissionRequest, TrustRule } from '../types'

// CID:trust-matching-001 - inferDomain
// Purpose: Derive request domain from explicit domain or tool prefix
// Used by: Hard block evaluation, evaluator defaults
export function inferDomain(request: PermissionRequest): string | undefined {
  if (typeof request.domain === 'string' && request.domain.length > 0) return request.domain
  const tool = typeof request.tool === 'string' ? request.tool : ''
  const dot = tool.indexOf('.')
  return dot > 0 ? tool.slice(0, dot) : undefined
}

// CID:trust-matching-002 - matchesScopePrefix
// Purpose: Check if request scope starts with rule prefix
function matchesScopePrefix(ruleScopePrefix: string | undefined, requestScope: string | undefined): boolean {
  if (!ruleScopePrefix) return true
  if (!requestScope) return false
  return requestScope.startsWith(ruleScopePrefix)
}

// CID:trust-matching-003 - findMatchingRule
// Purpose: Locate matching trust rule for request
// Used by: evaluatePermission rule lookup
export function findMatchingRule(request: PermissionRequest, rules: TrustRule[] | undefined): TrustRule | undefined {
  if (!rules || rules.length === 0) return undefined
  return rules.find(r => r.tool === request.tool && matchesScopePrefix(r.scopePrefix, request.scope))
}

// CID:trust-matching-004 - isHardBlocked
// Purpose: Evaluate whether request matches hard block configuration
// Used by: evaluatePermission to short-circuit deny
export function isHardBlocked(request: PermissionRequest, cfg: HardBlockConfig | undefined): { reason: string } | null {
  if (!cfg) return null

  const blockedTools = new Set(cfg.blockedTools ?? [])
  if (blockedTools.has(request.tool)) {
    return { reason: `hard-block:tool:${request.tool}` }
  }

  const domain = inferDomain(request)
  const blockedDomains = new Set(cfg.blockedDomains ?? [])
  if (domain && blockedDomains.has(domain)) {
    return { reason: `hard-block:domain:${domain}` }
  }

  const scope = request.scope
  for (const prefix of cfg.blockedScopePrefixes ?? []) {
    if (typeof scope === 'string' && scope.startsWith(prefix)) {
      return { reason: `hard-block:scope:${prefix}` }
    }
  }

  return null
}
