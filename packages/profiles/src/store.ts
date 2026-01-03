import crypto from 'node:crypto'
import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createDefaultProfile } from './profile'
import { parseProfile } from './validator'
import type { Profile } from './profile'

export class ProfileStore {
  constructor(private readonly profileRoot: string) {}

  private validateProfileId(profileId: string): void {
    if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(profileId)) {
      throw new Error(`Invalid profileId: ${profileId}`)
    }
  }

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

  private async writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = path.join(dir, `.tmp-${path.basename(filePath)}-${Date.now()}-${crypto.randomUUID()}`)
    const body = JSON.stringify(value, null, 2) + '\n'

    await fs.writeFile(tmp, body, 'utf8')
    await fs.rename(tmp, filePath)
  }

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

  async read(profileId: string): Promise<Profile> {
    const raw = await fs.readFile(this.profileJsonPath(profileId), 'utf8')
    return parseProfile(JSON.parse(raw))
  }

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

  async delete(profileId: string): Promise<void> {
    await this.withLock(profileId, async () => {
      const dir = this.resolveProfileDir(profileId)
      await fs.rm(dir, { recursive: true, force: false })
    })
  }
}
