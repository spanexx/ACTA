// Memory package baseline (Phase-1)
export const MEMORY_VERSION = "0.1.0"

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface MemoryEntry<T = any> {
  key: string
  value: T
  timestamp: number
  expiresAt?: number
}

export interface MemoryStore {
  add<T = any>(key: string, value: T, ttlSeconds?: number): Promise<void>
  get<T = any>(key: string): Promise<T | undefined>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  list(prefix?: string): Promise<MemoryEntry[]>
}

type PersistedState = {
  entries: Record<string, MemoryEntry>
}

class FileMemoryStore implements MemoryStore {
  constructor(private readonly dir: string) {}

  private statePath(): string {
    return path.join(path.resolve(this.dir), 'memory.json')
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(path.resolve(this.dir), { recursive: true })
  }

  private normalizeState(raw: any): PersistedState {
    const entries = raw?.entries
    if (!entries || typeof entries !== 'object') return { entries: {} }
    return { entries: entries as Record<string, MemoryEntry> }
  }

  private async loadState(): Promise<PersistedState> {
    try {
      const raw = await fs.readFile(this.statePath(), 'utf8')
      return this.normalizeState(JSON.parse(raw))
    } catch {
      return { entries: {} }
    }
  }

  private async saveState(state: PersistedState): Promise<void> {
    await this.ensureDir()
    const filePath = this.statePath()
    const dir = path.dirname(filePath)
    const tmp = path.join(dir, `.tmp-memory-${Date.now()}-${crypto.randomUUID()}`)
    const body = JSON.stringify(state, null, 2) + '\n'
    await fs.writeFile(tmp, body, 'utf8')
    await fs.rename(tmp, filePath)
  }

  private isExpired(entry: MemoryEntry, now: number): boolean {
    return typeof entry.expiresAt === 'number' && entry.expiresAt <= now
  }

  private async pruneExpired(state: PersistedState): Promise<boolean> {
    const now = Date.now()
    let changed = false
    for (const [k, v] of Object.entries(state.entries)) {
      if (v && this.isExpired(v, now)) {
        delete state.entries[k]
        changed = true
      }
    }
    return changed
  }

  async add<T = any>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const now = Date.now()
    const expiresAt = ttlSeconds !== undefined ? now + ttlSeconds * 1000 : undefined

    const state = await this.loadState()
    state.entries[key] = { key, value, timestamp: now, expiresAt }
    await this.saveState(state)
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    const state = await this.loadState()
    const entry = state.entries[key]
    if (!entry) return undefined

    const now = Date.now()
    if (this.isExpired(entry, now)) {
      delete state.entries[key]
      await this.saveState(state)
      return undefined
    }

    return entry.value as T
  }

  async delete(key: string): Promise<void> {
    const state = await this.loadState()
    if (!(key in state.entries)) return
    delete state.entries[key]
    await this.saveState(state)
  }

  async clear(): Promise<void> {
    await this.saveState({ entries: {} })
  }

  async list(prefix?: string): Promise<MemoryEntry[]> {
    const state = await this.loadState()
    const pruned = await this.pruneExpired(state)
    if (pruned) await this.saveState(state)

    const out: MemoryEntry[] = []
    for (const entry of Object.values(state.entries)) {
      if (!entry) continue
      if (prefix && !entry.key.startsWith(prefix)) continue
      out.push(entry)
    }

    out.sort((a, b) => a.timestamp - b.timestamp)
    return out
  }
}

class InMemoryMemoryStore implements MemoryStore {
  private store = new Map<string, MemoryEntry>()

  async add<T = any>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const now = Date.now()
    const expiresAt = ttlSeconds !== undefined ? now + ttlSeconds * 1000 : undefined
    this.store.set(key, { key, value, timestamp: now, expiresAt })
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async list(prefix?: string): Promise<MemoryEntry[]> {
    const now = Date.now()
    const result: MemoryEntry[] = []
    for (const entry of this.store.values()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.store.delete(entry.key)
        continue
      }
      if (prefix && !entry.key.startsWith(prefix)) continue
      result.push(entry)
    }
    return result
  }
}

export function createMemoryStore(): MemoryStore
export function createMemoryStore(opts?: { dir?: string }): MemoryStore
export function createMemoryStore(opts?: { dir?: string }): MemoryStore {
  const dir = typeof opts?.dir === 'string' ? opts.dir.trim() : ''
  if (dir.length) return new FileMemoryStore(dir)
  return new InMemoryMemoryStore()
}
