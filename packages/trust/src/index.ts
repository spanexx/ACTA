// Trust package scaffold (Phase-1)
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Logger } from '@acta/logging'

export const TRUST_VERSION = "0.1.0"

// Numeric trust levels aligned with Vision-Skeleton schema (0-4)
export type TrustLevel = 0 | 1 | 2 | 3 | 4

// Basic risk levels used to drive stub evaluation
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type PermissionDecisionSource =
  | 'hard-block'
  | 'rule'
  | 'tool-default'
  | 'domain-default'
  | 'profile-default'

export const PHASE1_DECISION_PRIORITY: PermissionDecisionSource[] = [
  'hard-block',
  'rule',
  'tool-default',
  'domain-default',
  'profile-default',
]

export type Phase1ScopeMatchMode = 'prefix'
export const PHASE1_SCOPE_MATCH_MODE: Phase1ScopeMatchMode = 'prefix'

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

export interface TrustRule {
  id: string
  createdAt?: number
  tool: string
  scopePrefix?: string
  decision: PermissionDecisionType
  remember?: 'session' | 'persistent'
}

export interface HardBlockConfig {
  blockedTools?: string[]
  blockedDomains?: string[]
  blockedScopePrefixes?: string[]
}

export interface TrustEvaluationOptions {
  hardBlock?: HardBlockConfig
  rules?: TrustRule[]
}

export interface PermissionRequest {
  id: string
  tool: string
  domain?: string
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
  source?: PermissionDecisionSource
}

function inferDomain(request: PermissionRequest): string | undefined {
  if (typeof request.domain === 'string' && request.domain.length > 0) return request.domain
  const tool = typeof request.tool === 'string' ? request.tool : ''
  const dot = tool.indexOf('.')
  return dot > 0 ? tool.slice(0, dot) : undefined
}

function matchesScopePrefix(ruleScopePrefix: string | undefined, requestScope: string | undefined): boolean {
  if (!ruleScopePrefix) return true
  if (!requestScope) return false
  return requestScope.startsWith(ruleScopePrefix)
}

function findMatchingRule(request: PermissionRequest, rules: TrustRule[] | undefined): TrustRule | undefined {
  if (!rules || rules.length === 0) return undefined
  return rules.find(r => r.tool === request.tool && matchesScopePrefix(r.scopePrefix, request.scope))
}

function isHardBlocked(request: PermissionRequest, cfg: HardBlockConfig | undefined): { reason: string } | null {
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

function decisionFromRiskAndTrustLevel(opts: {
  risk: RiskLevel
  trustLevel: TrustLevel
}): PermissionDecisionType {
  const { risk, trustLevel } = opts

  if (risk === 'low') return trustLevel >= 2 ? 'allow' : 'ask'
  if (risk === 'medium') return trustLevel >= 3 ? 'allow' : 'ask'
  if (risk === 'high') return trustLevel >= 4 ? 'allow' : 'ask'
  return 'ask'
}

 export class RuleStore {
   private readonly rulesPath: string

   constructor(opts: { profileTrustDir: string; fileName?: string }) {
     const root = path.resolve(opts.profileTrustDir)
     this.rulesPath = path.join(root, opts.fileName ?? 'rules.json')
   }

   private async readAll(): Promise<TrustRule[]> {
     try {
       const raw = await fs.readFile(this.rulesPath, 'utf8')
       const parsed = JSON.parse(raw)
       if (!Array.isArray(parsed)) return []

       return parsed.filter((r: any) => {
         if (!r || typeof r !== 'object') return false
         if (typeof r.id !== 'string' || r.id.length === 0) return false
         if (typeof r.tool !== 'string' || r.tool.length === 0) return false
         if (r.scopePrefix !== undefined && typeof r.scopePrefix !== 'string') return false
         if (r.decision !== 'deny' && r.decision !== 'ask' && r.decision !== 'allow') return false
         if (r.createdAt !== undefined && typeof r.createdAt !== 'number') return false
         if (r.remember !== undefined && r.remember !== 'session' && r.remember !== 'persistent') return false
         return true
       }) as TrustRule[]
     } catch {
       return []
     }
   }

   private async writeAllAtomic(rules: TrustRule[]): Promise<void> {
     const dir = path.dirname(this.rulesPath)
     await fs.mkdir(dir, { recursive: true })
 
     const tmp = path.join(dir, `.tmp-${path.basename(this.rulesPath)}-${Date.now()}-${randomUUID()}`)
     const body = JSON.stringify(rules, null, 2) + '\n'
 
     await fs.writeFile(tmp, body, 'utf8')
     await fs.rename(tmp, this.rulesPath)
   }

   async listRules(): Promise<TrustRule[]> {
     return await this.readAll()
   }

   async addRule(rule: Omit<TrustRule, 'id' | 'createdAt'> & Partial<Pick<TrustRule, 'id' | 'createdAt'>>): Promise<TrustRule> {
     if (!rule || typeof rule !== 'object') throw new Error('Invalid rule')
     if (typeof (rule as any).tool !== 'string' || !(rule as any).tool.trim()) throw new Error('Invalid rule.tool')
     const decision = (rule as any).decision
     if (decision !== 'deny' && decision !== 'ask' && decision !== 'allow') throw new Error('Invalid rule.decision')
     const scopePrefix = (rule as any).scopePrefix
     if (scopePrefix !== undefined && typeof scopePrefix !== 'string') throw new Error('Invalid rule.scopePrefix')
 
     const created: TrustRule = {
       id: typeof (rule as any).id === 'string' && (rule as any).id.length ? (rule as any).id : randomUUID(),
       createdAt: typeof (rule as any).createdAt === 'number' ? (rule as any).createdAt : Date.now(),
       tool: (rule as any).tool,
       scopePrefix: scopePrefix,
       decision,
       remember: (rule as any).remember,
     }

     const rules = await this.readAll()
     if (rules.some(r => r.id === created.id)) {
       throw new Error(`Rule already exists: ${created.id}`)
     }
     rules.push(created)
     await this.writeAllAtomic(rules)
     return created
   }

   async upsertRule(rule: TrustRule): Promise<TrustRule> {
     if (!rule || typeof rule !== 'object') throw new Error('Invalid rule')
     if (typeof rule.id !== 'string' || !rule.id.trim()) throw new Error('Invalid rule.id')
     if (typeof rule.tool !== 'string' || !rule.tool.trim()) throw new Error('Invalid rule.tool')
     if (rule.decision !== 'deny' && rule.decision !== 'ask' && rule.decision !== 'allow') throw new Error('Invalid rule.decision')
     if (rule.scopePrefix !== undefined && typeof rule.scopePrefix !== 'string') throw new Error('Invalid rule.scopePrefix')

     const rules = await this.readAll()
     const idx = rules.findIndex(r => r.id === rule.id)
     const next: TrustRule = {
       ...rule,
       createdAt: typeof rule.createdAt === 'number' ? rule.createdAt : Date.now(),
     }

     if (idx >= 0) rules[idx] = next
     else rules.push(next)

     await this.writeAllAtomic(rules)
     return next
   }

   async removeRule(ruleId: string): Promise<boolean> {
     if (typeof ruleId !== 'string' || !ruleId.trim()) return false
     const rules = await this.readAll()
     const next = rules.filter(r => r.id !== ruleId)
     if (next.length === rules.length) return false
     await this.writeAllAtomic(next)
     return true
   }

   async findMatchingRule(request: PermissionRequest): Promise<TrustRule | undefined> {
     const rules = await this.readAll()
     return findMatchingRule(request, rules)
   }
 }

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
     return await canExecute(request, profile, logger, { hardBlock: this.opts.hardBlock, rules })
   }
 }

// Phase-1 stub evaluator: always safe, never executes tools.
// For now, low-risk requests are allowed, everything else requires asking.
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

/**
 * Agent-facing API: check if a step can execute.
 * Returns a decision (deny/ask/allow) and audits the decision via logging.
 */
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
