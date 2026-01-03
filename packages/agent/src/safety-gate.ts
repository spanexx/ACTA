import type { AgentPlan } from '@acta/ipc'

export interface SafetyGateOptions {
  /** Blocked tool IDs (hard deny). */
  blockedTools?: string[]
  /** Blocked scopes/patterns (e.g., 'shell', 'system'). */
  blockedScopes?: string[]
}

/**
 * Safety gate validates plans against blocked tools/scopes.
 * Phase-1: simple blocklist; can emit error via callback.
 */
export class SafetyGate {
  private blockedTools: Set<string>
  private blockedScopes: Set<string>

  constructor(options?: SafetyGateOptions) {
    this.blockedTools = new Set(options?.blockedTools ?? [])
    this.blockedScopes = new Set(options?.blockedScopes ?? [])
  }

  /**
   * Validate a plan. Throws if blocked tools/scopes are found.
   */
  validate(plan: AgentPlan): void {
    for (const step of plan.steps) {
      if (this.blockedTools.has(step.tool)) {
        throw new Error(`Safety gate: blocked tool '${step.tool}' in step '${step.id}'`)
      }

      for (const scope of this.blockedScopes) {
        if (step.tool.includes(scope) || step.intent.includes(scope)) {
          throw new Error(`Safety gate: blocked scope '${scope}' in step '${step.id}'`)
        }
      }
    }
  }
}
