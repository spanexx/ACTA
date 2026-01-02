// Memory package baseline (Phase-1)
export const MEMORY_VERSION = "0.1.0"

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

export function createMemoryStore(): MemoryStore {
  return new InMemoryMemoryStore()
}
