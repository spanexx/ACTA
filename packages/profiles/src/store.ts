/*
 * Code Map: ProfileStore (Filesystem-backed profiles)
 * - Private helpers: id validation, dir resolution, locks, atomic writes.
 * - CRUD API: list/read/create/update/delete operating on profile.json per profile dir.
 *
 * CID Index:
 * CID:profile-store-001 -> ProfileStore class
 * CID:profile-store-002 -> validateProfileId
 * CID:profile-store-003 -> resolveProfileDir/profileJsonPath/lockPath
 * CID:profile-store-004 -> withLock
 * CID:profile-store-005 -> writeJsonAtomic
 * CID:profile-store-006 -> list
 * CID:profile-store-007 -> read
 * CID:profile-store-008 -> create
 * CID:profile-store-009 -> update
 * CID:profile-store-010 -> delete
 *
 * Lookup: rg -n "CID:profile-store-" packages/profiles/src/store.ts
 */

import crypto from 'node:crypto'
import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createDefaultProfile } from './profile'
import { parseProfile } from './validator'
import type { Profile } from './profile'

// CID:profile-store-001 - ProfileStore
// Purpose: Filesystem-backed storage for profiles with locking + validation.
// Uses: Node fs/path + profile helpers
// Used by: Runtime profile services
export class ProfileStore {
  constructor(private readonly profileRoot: string) {}

  // CID:profile-store-002 - validateProfileId
  // Purpose: Ensures ids stay within allowed pattern.
  // Uses: regex
  // Used by: internal helpers (resolve dir/locks)
  private validateProfileId(profileId: string): void {
    if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(profileId)) {
      throw new Error(`Invalid profileId: ${profileId}`)
    }
  }

  // CID:profile-store-003 - resolveProfileDir/Paths
  // Purpose: Resolves per-profile directories safely (no traversal).
  // Uses: path.resolve/relative
  // Used by: read/write helpers
  private resolveProfileDir(profileId: string): string {
    this.validateProfileId(profileId)

    const root = path.resolve(this.profileRoot)
    const dir = path.resolve(root, profileId)

    const rel = path.relative(root, dir)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Invalid profileId (path traversal): ${profileId}`)
    }

    return dir
  }

  private profileJsonPath(profileId: string): string {
    return path.join(this.resolveProfileDir(profileId), 'profile.json')
  }

  private lockPath(profileId: string): string {
    const root = path.resolve(this.profileRoot)
    return path.join(root, `.lock-${profileId}`)
  }

  // CID:profile-store-004 - withLock
  // Purpose: Provides best-effort exclusive lock per profile using .lock files.
  // Uses: fs.open('wx'), fs.unlink
  // Used by: create/update/delete flows
  private async withLock<T>(profileId: string, fn: () => Promise<T>): Promise<T> {
    this.validateProfileId(profileId)

    const root = path.resolve(this.profileRoot)
    await fs.mkdir(root, { recursive: true })

    const lockFile = this.lockPath(profileId)
    const handle = await fs.open(lockFile, 'wx')

    try {
      return await fn()
    } finally {
      await handle.close().catch(() => undefined)
      await fs.unlink(lockFile).catch(() => undefined)
    }
  }

  // CID:profile-store-005 - writeJsonAtomic
  // Purpose: Writes JSON atomically via temp file & rename.
  // Uses: fs.writeFile/rename
  // Used by: create/update
  private async writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = path.join(dir, `.tmp-${path.basename(filePath)}-${Date.now()}-${crypto.randomUUID()}`)
    const body = JSON.stringify(value, null, 2) + '\n'

    await fs.writeFile(tmp, body, 'utf8')
    await fs.rename(tmp, filePath)
  }

  // CID:profile-store-006 - list Profiles
  // Purpose: Lists all profile directories, parses profile.json, sorts by name.
  // Uses: fs.readdir/readFile, parseProfile()
  // Used by: Profile services
  async list(): Promise<Profile[]> {
    const root = path.resolve(this.profileRoot)

    let entries: Dirent[] = []
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      return []
    }

    const profiles: Profile[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const id = entry.name

      if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(id)) continue

      try {
        const raw = await fs.readFile(this.profileJsonPath(id), 'utf8')
        const parsed = JSON.parse(raw)
        profiles.push(parseProfile(parsed))
      } catch {
        continue
      }
    }

    profiles.sort((a, b) => a.name.localeCompare(b.name))
    return profiles
  }

  // CID:profile-store-007 - read Profile
  // Purpose: Reads a single profile.json and parses it.
  // Uses: parseProfile()
  // Used by: Profile operations/update
  async read(profileId: string): Promise<Profile> {
    const raw = await fs.readFile(this.profileJsonPath(profileId), 'utf8')
    return parseProfile(JSON.parse(raw))
  }

  // CID:profile-store-008 - create Profile
  // Purpose: Creates a new profile directory with default profile contents.
  // Uses: createDefaultProfile(), fs mkdirs, writeJsonAtomic
  async create(opts: {
    name: string
    profileId?: string
    now?: number
  }): Promise<Profile> {
    const id = (opts.profileId ?? crypto.randomUUID()).toLowerCase()

    return await this.withLock(id, async () => {
      const root = path.resolve(this.profileRoot)
      await fs.mkdir(root, { recursive: true })

      const profileDir = this.resolveProfileDir(id)
      const profileJson = path.join(profileDir, 'profile.json')

      try {
        await fs.stat(profileDir)
        throw new Error(`Profile already exists: ${id}`)
      } catch {
        // ok
      }

      const profile = createDefaultProfile({ id, name: opts.name, now: opts.now })

      await fs.mkdir(profileDir, { recursive: true })
      await fs.mkdir(path.join(profileDir, profile.paths.logs), { recursive: true })
      await fs.mkdir(path.join(profileDir, profile.paths.memory), { recursive: true })
      await fs.mkdir(path.join(profileDir, profile.paths.trust), { recursive: true })

      await this.writeJsonAtomic(profileJson, profile)
      return profile
    })
  }

  // CID:profile-store-009 - update Profile
  // Purpose: Applies updater, validates result, ensures directories exist, writes profile.json.
  // Uses: parseProfile(), writeJsonAtomic()
  async update(profileId: string, updater: (current: Profile) => Profile): Promise<Profile> {
    return await this.withLock(profileId, async () => {
      const current = await this.read(profileId)
      const next = updater(current)

      if (!next || typeof next !== 'object') {
        throw new Error('Updater must return a Profile')
      }
      if (next.id !== current.id) {
        throw new Error('Profile id cannot be changed')
      }

      const parsedNext = parseProfile(next)

      const profileDir = this.resolveProfileDir(profileId)
      await fs.mkdir(profileDir, { recursive: true })
      await fs.mkdir(path.join(profileDir, parsedNext.paths.logs), { recursive: true })
      await fs.mkdir(path.join(profileDir, parsedNext.paths.memory), { recursive: true })
      await fs.mkdir(path.join(profileDir, parsedNext.paths.trust), { recursive: true })

      await this.writeJsonAtomic(this.profileJsonPath(profileId), parsedNext)
      return parsedNext
    })
  }

  // CID:profile-store-010 - delete Profile
  // Purpose: Removes profile directory while holding lock.
  async delete(profileId: string): Promise<void> {
    await this.withLock(profileId, async () => {
      const dir = this.resolveProfileDir(profileId)
      await fs.rm(dir, { recursive: true, force: false })
    })
  }
}
