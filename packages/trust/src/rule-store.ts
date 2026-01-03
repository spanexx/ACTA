import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import type { PermissionRequest, TrustRule } from './types'
import { findMatchingRule as findRuleMatch } from './internal/matching'

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
    return findRuleMatch(request, rules)
  }
}
