/*
 * Code Map: Active Profile Pointer
 * - activePointerPath(): Computes the path to the active profile pointer file.
 * - withActiveLock(): Provides a coarse lock to serialize active profile pointer writes.
 * - readActivePointer()/writeActivePointer(): Reads/writes the activeProfile.json pointer file.
 *
 * CID Index:
 * CID:active-pointer-001 -> activePointerPath
 * CID:active-pointer-002 -> withActiveLock
 * CID:active-pointer-003 -> readActivePointer
 * CID:active-pointer-004 -> writeActivePointer
 *
 * Lookup: rg -n "CID:active-pointer-" apps/runtime/src/profile/active-pointer.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import type { ActiveProfilePointer } from './types'

// CID:active-pointer-001 - Active Pointer File Path
// Purpose: Computes the absolute path to the active profile pointer JSON file.
// Uses: node:path
// Used by: init.ts and operations.ts (read/write active profile pointer)
export function activePointerPath(profileRoot: string): string {
  return path.join(path.resolve(profileRoot), 'activeProfile.json')
}

// CID:active-pointer-002 - Active Pointer Lock
// Purpose: Serializes concurrent updates to the active profile pointer via a best-effort lock file.
// Uses: fs.open('wx') for exclusive create; fs.unlink for cleanup
// Used by: init.ts and operations.ts to guard pointer reads/writes
export async function withActiveLock<T>(profileRoot: string, fn: () => Promise<T>): Promise<T> {
  const root = path.resolve(profileRoot)
  await fs.mkdir(root, { recursive: true })

  const lockFile = path.join(root, '.lock-activeProfile')
  const handle = await fs.open(lockFile, 'wx')

  try {
    return await fn()
  } finally {
    await handle.close().catch(() => undefined)
    await fs.unlink(lockFile).catch(() => undefined)
  }
}

// CID:active-pointer-003 - Read Active Pointer
// Purpose: Reads and validates the active profile pointer file.
// Uses: fs.readFile, JSON.parse
// Used by: init.ts
export async function readActivePointer(profileRoot: string): Promise<ActiveProfilePointer | null> {
  try {
    const raw = await fs.readFile(activePointerPath(profileRoot), 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof (parsed as any).profileId !== 'string') return null
    return { profileId: (parsed as any).profileId }
  } catch {
    return null
  }
}

// CID:active-pointer-004 - Write Active Pointer
// Purpose: Writes the active profile pointer file.
// Uses: fs.writeFile
// Used by: init.ts and operations.ts
export async function writeActivePointer(profileRoot: string, profileId: string): Promise<void> {
  const body = JSON.stringify({ profileId }, null, 2) + '\n'
  await fs.writeFile(activePointerPath(profileRoot), body, 'utf8')
}
