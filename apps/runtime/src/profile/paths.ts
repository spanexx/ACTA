/*
 * Code Map: Profile Path Resolution
 * - validateProfileId(): Validates profile ids (format + length).
 * - resolveProfileDir(): Resolves a profile directory with path traversal protection.
 * - resolveProfileScopedDir(): Resolves a path inside a profile directory.
 * - resolveSafeProfileDir(): Resolves root/dir pair with validation for delete/archive operations.
 *
 * CID Index:
 * CID:paths-001 -> validateProfileId
 * CID:paths-002 -> resolveProfileDir
 * CID:paths-003 -> resolveProfileScopedDir
 * CID:paths-004 -> resolveSafeProfileDir
 *
 * Lookup: rg -n "CID:paths-" apps/runtime/src/profile/paths.ts
 */

import path from 'node:path'

// CID:paths-001 - Validate Profile ID
// Purpose: Validates a profile id against an allowlist regex.
// Uses: regex match
// Used by: resolveProfileDir(); resolveSafeProfileDir(); profile operations
export function validateProfileId(profileId: string): void {
  if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(profileId)) {
    throw new Error(`Invalid profileId: ${profileId}`)
  }
}

// CID:paths-002 - Resolve Profile Directory
// Purpose: Resolves the profile directory for a profile id and prevents path traversal.
// Uses: validateProfileId(), path.resolve/relative
// Used by: resolveProfileScopedDir(); queries (dir resolution)
export function resolveProfileDir(profileRoot: string, profileId: string): string {
  validateProfileId(profileId)
  const root = path.resolve(profileRoot)
  const dir = path.resolve(root, profileId)

  const rel = path.relative(root, dir)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Invalid profileId (path traversal): ${profileId}`)
  }

  return dir
}

// CID:paths-003 - Resolve Profile-Scoped Directory
// Purpose: Resolves a relative subpath inside the profile directory.
// Uses: resolveProfileDir(), path.join
// Used by: queries.ts and active-dirs.ts to compute logs/memory/trust dirs
export function resolveProfileScopedDir(profileRoot: string, profileId: string, rel: string): string {
  const profileDir = resolveProfileDir(profileRoot, profileId)
  return path.join(profileDir, rel)
}

// CID:paths-004 - Resolve Safe Root/Dir Pair
// Purpose: Resolves root/dir pair for file operations with validation and traversal prevention.
// Uses: path.resolve/relative and regex validation
// Used by: operations.ts deleteProfile()
export function resolveSafeProfileDir(profileRoot: string, profileId: string): { root: string; dir: string } {
  const root = path.resolve(profileRoot)
  const dir = path.resolve(root, profileId)
  const rel = path.relative(root, dir)

  if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(profileId) || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Invalid profileId: ${profileId}`)
  }

  return { root, dir }
}
