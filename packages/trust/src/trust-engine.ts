import type { Logger } from '@acta/logging'

import type { HardBlockConfig, PermissionDecision, PermissionRequest, TrustEvaluationOptions, TrustProfile } from './types'
import { canExecute } from './can-execute'
import { evaluatePermission } from './evaluator'
import { RuleStore } from './rule-store'

export class TrustEngine {
  constructor(
    private opts: {
      ruleStore?: RuleStore
      hardBlock?: HardBlockConfig
    } = {},
  ) {}

  async evaluate(request: PermissionRequest, profile?: TrustProfile | null): Promise<PermissionDecision> {
    const rules = this.opts.ruleStore ? await this.opts.ruleStore.listRules() : undefined
    return evaluatePermission(request, profile, { hardBlock: this.opts.hardBlock, rules })
  }

  async canExecute(request: PermissionRequest, profile?: TrustProfile | null, logger?: Logger): Promise<PermissionDecision> {
    const rules = this.opts.ruleStore ? await this.opts.ruleStore.listRules() : undefined
    return await canExecute(request, profile, logger, { hardBlock: this.opts.hardBlock, rules } as TrustEvaluationOptions)
  }
}
