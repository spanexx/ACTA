/**
 * Code Map
 * Responsibilities:
 * - Define default ordering for phase-1 permission decision sources.
 * - Declare scope matching mode used during phase-1 evaluation.
 * CID Index:
 * - CID:phase1-001 -> PHASE1_DECISION_PRIORITY array
 * - CID:phase1-002 -> PHASE1_SCOPE_MATCH_MODE constant
 * Quick lookup: `rg -n "CID:phase1-" packages/trust/src/phase1.ts`
 */

import type { PermissionDecisionSource } from './types'

// CID:phase1-001 Decision source precedence
// Purpose: Establishes the ordered priority list used when selecting a phase-1 permission decision source.
// Uses: PermissionDecisionSource union type from ./types to ensure valid identifiers.
// Used by: Phase-1 evaluation logic (e.g., evaluator/can-execute flows) when resolving which decision source wins.
export const PHASE1_DECISION_PRIORITY: PermissionDecisionSource[] = [
  'hard-block',
  'rule',
  'tool-default',
  'domain-default',
  'profile-default',
]

export type Phase1ScopeMatchMode = 'prefix'
// CID:phase1-002 Scope matching mode
// Purpose: Captures the canonical scope matching strategy (currently prefix-only) for phase-1 evaluation.
// Uses: Phase1ScopeMatchMode literal type for compile-time enforcement.
// Used by: Matching utilities that interpret scope comparisons during permission evaluation.
export const PHASE1_SCOPE_MATCH_MODE: Phase1ScopeMatchMode = 'prefix'
