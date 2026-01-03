/*
 * Code Map: Memory Manager
 * - MemoryManagerOptions: Configuration for memory retention
 * - MemoryManager class: Wraps MemoryStore with scoping, TTL, limits
 *   - add/get/delete/clear/list: CRUD helpers
 *   - enforceLimit: internal trimming
 *
 * CID Index:
 * CID:memory-manager-001 -> MemoryManagerOptions
 * CID:memory-manager-002 -> MemoryManager class
 * CID:memory-manager-003 -> add method
 * CID:memory-manager-004 -> get method
 * CID:memory-manager-005 -> delete method
 * CID:memory-manager-006 -> clear method
 * CID:memory-manager-007 -> list method
 * CID:memory-manager-008 -> enforceLimit
 *
 * Quick lookup: rg -n "CID:memory-manager-" /home/spanexx/Shared/Projects/ACTA/packages/agent/src/memory-manager.ts
 */

import type { MemoryStore } from '@acta/memory'

// CID:memory-manager-001 - MemoryManagerOptions
// Purpose: Configure memory limits and namespace prefix
// Uses: Optional max entries, key prefix
// Used by: MemoryManager constructor
export interface MemoryManagerOptions {
  /** Maximum number of memory entries to retain. */
  maxEntries?: number
  /** Key prefix for agent-scoped memory. */
  prefix?: string
}

// CID:memory-manager-002 - MemoryManager class
// Purpose: Provide scoped helpers for MemoryStore with automatic trimming
// Uses: MemoryStore interface, options
// Used by: Acta runtime for memory persistence
export class MemoryManager {
  private store: MemoryStore
  private maxEntries: number
  private prefix: string

  constructor(store: MemoryStore, options?: MemoryManagerOptions) {
    this.store = store
    this.maxEntries = options?.maxEntries ?? 100
    this.prefix = options?.prefix ?? 'agent'
  }

  /**
   * Add a memory entry with optional TTL (seconds).
   * Enforces size limits by trimming oldest entries if needed.
   */
  // CID:memory-manager-003 - add
  // Purpose: Store value with optional TTL and enforce size
  // Uses: MemoryStore.add, enforceLimit
  async add<T = any>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = `${this.prefix}:${key}`
    await this.store.add(fullKey, value, ttlSeconds)
    await this.enforceLimit()
  }

  /** Retrieve a memory entry by key. */
  // CID:memory-manager-004 - get
  // Purpose: Fetch scoped memory value
  async get<T = any>(key: string): Promise<T | undefined> {
    const fullKey = `${this.prefix}:${key}`
    return this.store.get<T>(fullKey)
  }

  /** Delete a memory entry by key. */
  // CID:memory-manager-005 - delete
  // Purpose: Remove scoped memory entry
  async delete(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`
    await this.store.delete(fullKey)
  }

  /** Clear all agent-scoped memory entries. */
  // CID:memory-manager-006 - clear
  // Purpose: Remove all entries with prefix
  async clear(): Promise<void> {
    const entries = await this.store.list(this.prefix)
    for (const entry of entries) {
      await this.store.delete(entry.key)
    }
  }

  /** List all agent-scoped memory entries. */
  // CID:memory-manager-007 - list
  // Purpose: Return normalized key/value/timestamp list
  async list(): Promise<Array<{ key: string; value: any; timestamp: number }>> {
    const entries = await this.store.list(this.prefix)
    return entries.map(e => ({
      key: e.key.slice(this.prefix.length + 1),
      value: e.value,
      timestamp: e.timestamp,
    }))
  }

  /** Trim entries to enforce maxEntries limit (FIFO). */
  // CID:memory-manager-008 - enforceLimit
  // Purpose: Ensure store does not exceed maxEntries by deleting oldest
  private async enforceLimit(): Promise<void> {
    const entries = await this.store.list(this.prefix)
    if (entries.length <= this.maxEntries) return

    const toDelete = entries.slice(0, entries.length - this.maxEntries)
    for (const entry of toDelete) {
      await this.store.delete(entry.key)
    }
  }
}
