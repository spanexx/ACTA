/**
 * Code Map
 * Responsibilities:
 * - Provide a high-level trust evaluation entrypoint over rules, hard blocks, and profile data.
 * - Orchestrate dependency wiring (RuleStore, hard block config) for downstream evaluators.
 * - Offer helper methods for binary can-execute checks versus full evaluations.
 * CID Index:
 * - CID:trust-engine-001 -> TrustEngine class + constructor
 * - CID:trust-engine-002 -> evaluate method
 * - CID:trust-engine-003 -> canExecute method
 * Quick lookup: `rg -n "CID:trust-engine-" packages/trust/src/trust-engine.ts`
 */

import type { Logger } from '@acta/logging'

import type { HardBlockConfig, PermissionDecision, PermissionRequest, TrustEvaluationOptions, TrustProfile } from './types'
import { canExecute } from './can-execute'
import { evaluatePermission } from './evaluator'
import { RuleStore } from './rule-store'

// CID:trust-engine-001 TrustEngine orchestrator
// Purpose: Holds optional RuleStore + hard-block config dependencies and exposes evaluation helpers.
// Uses: RuleStore to fetch rules, HardBlockConfig for blocking logic.
// Used by: Runtime permission flows needing centralized trust decisions.
export class TrustEngine {
  constructor(
    private opts: {
      ruleStore?: RuleStore
      hardBlock?: HardBlockConfig
    } = {},
  ) {}

  // CID:trust-engine-002 evaluate()
  // Purpose: Runs the full evaluation pipeline by gathering optional rules and delegating to evaluatePermission.
  // Uses: evaluatePermission helper plus stored hardBlock/ruleStore dependencies.
  // Used by: Callers needing detailed PermissionDecision output.
  async evaluate(request: PermissionRequest, profile?: TrustProfile | null): Promise<PermissionDecision> {
    const rules = this.opts.ruleStore ? await this.opts.ruleStore.listRules() : undefined
    return evaluatePermission(request, profile, { hardBlock: this.opts.hardBlock, rules })
  }

  // CID:trust-engine-003 canExecute()
  // Purpose: Performs a lightweight executable check, forwarding logger + options to canExecute helper.
  // Uses: canExecute helper, TrustEvaluationOptions for evaluation context.
  // Used by: Execution gating logic that only needs allow/deny semantics with logging insight.
  async canExecute(request: PermissionRequest, profile?: TrustProfile | null, logger?: Logger): Promise<PermissionDecision> {
    const rules = this.opts.ruleStore ? await this.opts.ruleStore.listRules() : undefined
    return await canExecute(request, profile, logger, { hardBlock: this.opts.hardBlock, rules } as TrustEvaluationOptions)
  }
}
