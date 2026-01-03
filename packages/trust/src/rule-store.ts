/**
 * Code Map
 * Responsibilities:
 * - Persist, validate, and retrieve trust rules stored on disk.
 * - Provide high-level CRUD helpers plus matching utilities for permission requests.
 * - Safely serialize rule mutations using atomic file writes.
 * CID Index:
 * - CID:rule-store-001 -> RuleStore class shell
 * - CID:rule-store-002 -> readAll loader/validator
 * - CID:rule-store-003 -> writeAllAtomic persister
 * - CID:rule-store-004 -> listRules facade
 * - CID:rule-store-005 -> addRule creator
 * - CID:rule-store-006 -> upsertRule updater
 * - CID:rule-store-007 -> removeRule deleter
 * - CID:rule-store-008 -> findMatchingRule matcher bridge
 * Quick lookup: `rg -n "CID:rule-store-" packages/trust/src/rule-store.ts`
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import type { PermissionRequest, TrustRule } from './types'
import { findMatchingRule as findRuleMatch } from './internal/matching'

// CID:rule-store-001 RuleStore disk-backed registry
// Purpose: Encapsulates rule persistence within a profile-specific directory, exposing CRUD + matching helpers.
// Uses: node:fs/promises, node:path, node:crypto for filesystem operations; TrustRule/PermissionRequest types.
// Used by: TrustEngine and surrounding trust modules needing deterministic rule evaluation.
export class RuleStore {
  private readonly rulesPath: string

  constructor(opts: { profileTrustDir: string; fileName?: string }) {
    const root = path.resolve(opts.profileTrustDir)
    this.rulesPath = path.join(root, opts.fileName ?? 'rules.json')
  }

  // CID:rule-store-002 Read + validate rules
  // Purpose: Loads rules from disk and filters out malformed entries to keep downstream logic safe.
  // Uses: fs.readFile for IO, JSON parsing, inline validators.
  // Used by: All CRUD operations plus match helper to get consistent in-memory view.
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

  // CID:rule-store-003 Atomic writer
  // Purpose: Serializes rules to disk via temp-file strategy to avoid partial writes/corruption.
  // Uses: fs.mkdir/writeFile/rename plus randomUUID for unique temp names.
  // Used by: addRule/upsertRule/removeRule to persist snapshot updates.
  private async writeAllAtomic(rules: TrustRule[]): Promise<void> {
    const dir = path.dirname(this.rulesPath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = path.join(dir, `.tmp-${path.basename(this.rulesPath)}-${Date.now()}-${randomUUID()}`)
    const body = JSON.stringify(rules, null, 2) + '\n'

    await fs.writeFile(tmp, body, 'utf8')
    await fs.rename(tmp, this.rulesPath)
  }

  // CID:rule-store-004 Rule listing facade
  // Purpose: Provides a public entrypoint for consumers needing the full rule set.
  // Uses: readAll helper to reuse validation logic.
  // Used by: TrustEngine and other trust evaluators fetching context.
  async listRules(): Promise<TrustRule[]> {
    return await this.readAll()
  }

  // CID:rule-store-005 Add rule
  // Purpose: Validates inputs, generates identifiers/timestamps, and appends the new rule atomically.
  // Uses: readAll/writeAllAtomic plus randomUUID/Date.now for metadata.
  // Used by: UI/API layers recording explicit user trust decisions.
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

  // CID:rule-store-006 Upsert rule
  // Purpose: Replaces or inserts rules while ensuring minimal validation and timestamp hygiene.
  // Uses: readAll/writeAllAtomic, spreads existing rule, normalizes createdAt.
  // Used by: Sync/import flows or editors that need idempotent updates.
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

  // CID:rule-store-007 Remove rule
  // Purpose: Deletes a rule by id and persists the truncated list.
  // Uses: readAll/writeAllAtomic for consistent storage updates.
  // Used by: Trust management tooling when revoking remembered decisions.
  async removeRule(ruleId: string): Promise<boolean> {
    if (typeof ruleId !== 'string' || !ruleId.trim()) return false
    const rules = await this.readAll()
    const next = rules.filter(r => r.id !== ruleId)
    if (next.length === rules.length) return false
    await this.writeAllAtomic(next)
    return true
  }

  // CID:rule-store-008 Rule matcher bridge
  // Purpose: Loads rules and delegates to internal matcher to find the first applicable rule for a request.
  // Uses: readAll for storage, findRuleMatch for matching semantics.
  // Used by: TrustEngine evaluation paths as part of rule-based decision sourcing.
  async findMatchingRule(request: PermissionRequest): Promise<TrustRule | undefined> {
    const rules = await this.readAll()
    return findRuleMatch(request, rules)
  }
}
