/*
 * Code Map: Shared ID Helpers
 * - newId(): Generates a best-effort unique id for UI usage.
 *
 * CID Index:
 * CID:shared-ids-001 -> newId
 *
 * Lookup: rg -n "CID:shared-ids-" apps/ui/src/app/shared/ids.ts
 */

// CID:shared-ids-001 - New ID
// Purpose: Generates an ID using crypto.randomUUID when available, with a timestamp+random fallback.
// Uses: globalThis.crypto.randomUUID
// Used by: Imported by various UI helpers (e.g. chat-state/*, runtime-ipc/*)
export function newId(): string {
  const c = (globalThis as any).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
