import fs from 'node:fs/promises'
import path from 'node:path'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { loadConfig } from '@acta/core'
import { setLogDirectoryProvider } from '@acta/logging'
import { ProfileStore, type Profile, type TrustLevel } from '@acta/profiles'

export type ProfileUpdatePatch = {
  name?: string
  setupComplete?: boolean
  trust?: {
    defaultTrustLevel?: TrustLevel
    tools?: Record<string, TrustLevel>
    domains?: Record<string, TrustLevel>
  }
  llm?: {
    mode?: 'local' | 'cloud'
    adapterId?: string
    model?: string
    endpoint?: string
    cloudWarnBeforeSending?: boolean
  }
}

type ActiveProfilePointer = {
  profileId: string
}

@Injectable()
export class ProfileService implements OnModuleInit {
  private readonly profileRoot: string
  private readonly store: ProfileStore
  private activeProfileId: string | null = null

  private activeLogsDir: string | null = null
  private activeMemoryDir: string | null = null

  constructor(profileRoot?: string) {
    const cfg = loadConfig()
    this.profileRoot = profileRoot ?? cfg.profileRoot
    this.store = new ProfileStore(this.profileRoot)
  }

  async onModuleInit(): Promise<void> {
    await this.init()
    setLogDirectoryProvider(() => this.activeLogsDir)
  }

  private activePointerPath(): string {
    return path.join(path.resolve(this.profileRoot), 'activeProfile.json')
  }

  private async withActiveLock<T>(fn: () => Promise<T>): Promise<T> {
    const root = path.resolve(this.profileRoot)
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

  private async readActivePointer(): Promise<ActiveProfilePointer | null> {
    try {
      const raw = await fs.readFile(this.activePointerPath(), 'utf8')
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return null
      if (typeof (parsed as any).profileId !== 'string') return null
      return { profileId: (parsed as any).profileId }
    } catch {
      return null
    }
  }

  private async writeActivePointer(profileId: string): Promise<void> {
    const body = JSON.stringify({ profileId }, null, 2) + '\n'
    await fs.writeFile(this.activePointerPath(), body, 'utf8')
  }

  async init(): Promise<void> {
    if (this.activeProfileId) return
    await fs.mkdir(path.resolve(this.profileRoot), { recursive: true })

    const cfg = loadConfig()
    const desiredDefaultId = (cfg.profileId ?? 'default').toLowerCase()

    await this.withActiveLock(async () => {
      const pointer = await this.readActivePointer()
      if (pointer) {
        try {
          await this.store.read(pointer.profileId)
          this.activeProfileId = pointer.profileId
          return
        } catch {
          // fall through
        }
      }

      const legacyActiveId = await this.maybeMigrateLegacyProfiles().catch(() => null)

      const existing = await this.store.list()
      if (existing.length) {
        const match = legacyActiveId ? existing.find(p => p.id === legacyActiveId) : undefined
        this.activeProfileId = match?.id ?? existing[0].id
        await this.writeActivePointer(this.activeProfileId)
        return
      }

      const created = await this.store.create({
        profileId: desiredDefaultId,
        name: 'Default',
      })
      this.activeProfileId = created.id
      await this.writeActivePointer(created.id)
    })

    await this.refreshActiveDirs().catch(() => undefined)
  }

  private legacyMigrationMarkerPath(): string {
    return path.join(path.resolve(this.profileRoot), 'legacyMigration.json')
  }

  private async hasLegacyMigrationMarker(): Promise<boolean> {
    try {
      await fs.stat(this.legacyMigrationMarkerPath())
      return true
    } catch {
      return false
    }
  }

  private async writeLegacyMigrationMarker(payload: { legacyProfilesRoot: string; completedAt: number }): Promise<void> {
    const body = JSON.stringify(payload, null, 2) + '\n'
    await fs.writeFile(this.legacyMigrationMarkerPath(), body, 'utf8')
  }

  private async readLegacyActiveProfileId(legacyProfilesRoot: string): Promise<string | null> {
    const legacyUserDataDir = path.dirname(path.resolve(legacyProfilesRoot))
    const pointerPath = path.join(legacyUserDataDir, 'activeProfile.json')

    try {
      const raw = await fs.readFile(pointerPath, 'utf8')
      const parsed = JSON.parse(raw)
      const id = typeof parsed?.profileId === 'string' ? parsed.profileId.trim() : ''
      if (!id.length) return null
      if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(id)) return null
      return id
    } catch {
      return null
    }
  }

  private async resolveLegacyProfilesRoot(): Promise<string | null> {
    const explicit = (process.env.ACTA_LEGACY_PROFILE_ROOT ?? '').trim()
    if (explicit.length) return path.resolve(explicit)

    const home = process.env.HOME ? path.resolve(process.env.HOME) : ''
    const xdgConfigHome = (process.env.XDG_CONFIG_HOME ?? (home ? path.join(home, '.config') : '')).trim()

    const candidates: string[] = []
    if (process.platform === 'win32') {
      const appData = (process.env.APPDATA ?? '').trim()
      if (appData.length) candidates.push(path.join(appData, 'ACTA', 'profiles'))
    } else if (process.platform === 'darwin') {
      if (home.length) candidates.push(path.join(home, 'Library', 'Application Support', 'ACTA', 'profiles'))
    } else {
      if (xdgConfigHome.length) {
        candidates.push(path.join(xdgConfigHome, 'ACTA', 'profiles'))
        candidates.push(path.join(xdgConfigHome, 'acta', 'profiles'))
      }
    }

    for (const c of candidates) {
      const resolved = path.resolve(c)
      try {
        const st = await fs.stat(resolved)
        if (st.isDirectory()) return resolved
      } catch {
        continue
      }
    }

    return null
  }

  private async maybeMigrateLegacyProfiles(): Promise<string | null> {
    const force = (process.env.ACTA_FORCE_LEGACY_MIGRATION ?? '').trim() === '1'
    if (!force) {
      const hasMarker = await this.hasLegacyMigrationMarker()
      if (hasMarker) return null
    }

    const legacyProfilesRoot = await this.resolveLegacyProfilesRoot()
    if (!legacyProfilesRoot) return null

    const runtimeRoot = path.resolve(this.profileRoot)
    const legacyRootResolved = path.resolve(legacyProfilesRoot)
    if (legacyRootResolved === runtimeRoot) {
      await this.writeLegacyMigrationMarker({ legacyProfilesRoot: legacyRootResolved, completedAt: Date.now() })
      return null
    }

    const legacyActiveId = await this.readLegacyActiveProfileId(legacyRootResolved)

    let entries: Array<{ name: string; isDir: boolean }> = []
    try {
      const dirents = await fs.readdir(legacyRootResolved, { withFileTypes: true })
      entries = dirents.map(d => ({ name: d.name, isDir: d.isDirectory() }))
    } catch {
      return null
    }

    for (const e of entries) {
      if (!e.isDir) continue
      const profileId = e.name
      if (profileId.startsWith('_')) continue
      if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(profileId)) continue

      try {
        await this.store.read(profileId)
        continue
      } catch {
        // not present, attempt import
      }

      const configPath = path.join(legacyRootResolved, profileId, 'config.json')
      let cfgRaw: any = null
      try {
        const raw = await fs.readFile(configPath, 'utf8')
        cfgRaw = JSON.parse(raw)
      } catch {
        cfgRaw = null
      }

      const name = typeof cfgRaw?.name === 'string' && cfgRaw.name.trim().length ? cfgRaw.name.trim() : profileId
      const setupComplete = typeof cfgRaw?.setupComplete === 'boolean' ? cfgRaw.setupComplete : false

      const trustLevelNum = typeof cfgRaw?.trustLevel === 'number' ? cfgRaw.trustLevel : Number(cfgRaw?.trustLevel)
      const trustLevel: TrustLevel = (trustLevelNum === 0 || trustLevelNum === 1 || trustLevelNum === 2 || trustLevelNum === 3
        ? trustLevelNum
        : 2) as TrustLevel

      const adapterId = typeof cfgRaw?.modelProvider === 'string' && cfgRaw.modelProvider.trim().length ? cfgRaw.modelProvider : 'ollama'
      const mode: 'local' | 'cloud' = adapterId === 'openai' || adapterId === 'anthropic' ? 'cloud' : 'local'

      const model = typeof cfgRaw?.model === 'string' && cfgRaw.model.trim().length ? cfgRaw.model : 'llama3:8b'
      const endpoint = typeof cfgRaw?.endpoint === 'string' && cfgRaw.endpoint.trim().length ? cfgRaw.endpoint : undefined
      const cloudWarnBeforeSending =
        typeof cfgRaw?.cloudWarnBeforeSending === 'boolean' ? cfgRaw.cloudWarnBeforeSending : undefined

      await this.store.create({ profileId, name })
      await this.store.update(profileId, current => {
        return {
          ...current,
          updatedAt: Date.now(),
          name,
          setupComplete,
          trust: {
            ...current.trust,
            defaultTrustLevel: trustLevel,
          },
          llm: {
            ...current.llm,
            mode,
            adapterId,
            model,
            endpoint,
            cloudWarnBeforeSending,
          },
        }
      })
    }

    await this.writeLegacyMigrationMarker({ legacyProfilesRoot: legacyRootResolved, completedAt: Date.now() })
    return legacyActiveId
  }

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

  private resolveProfileScopedDir(profileId: string, rel: string): string {
    const profileDir = this.resolveProfileDir(profileId)
    return path.join(profileDir, rel)
  }

  private async refreshActiveDirs(): Promise<void> {
    const id = this.activeProfileId
    if (!id) {
      this.activeLogsDir = null
      this.activeMemoryDir = null
      return
    }

    try {
      const profile = await this.store.read(id)
      this.activeLogsDir = this.resolveProfileScopedDir(id, profile.paths.logs)
      this.activeMemoryDir = this.resolveProfileScopedDir(id, profile.paths.memory)
    } catch {
      this.activeLogsDir = this.resolveProfileScopedDir(id, 'logs')
      this.activeMemoryDir = this.resolveProfileScopedDir(id, 'memory')
    }
  }

  getActiveProfileId(): string | null {
    return this.activeProfileId
  }

  getActiveLogsDir(): string | null {
    return this.activeLogsDir
  }

  getActiveMemoryDir(): string | null {
    return this.activeMemoryDir
  }

  async getLogsDir(profileId?: string): Promise<string> {
    const resolved = profileId ?? this.activeProfileId
    if (!resolved) throw new Error('No active profile')
    const profile = await this.store.read(resolved)
    return this.resolveProfileScopedDir(resolved, profile.paths.logs)
  }

  async getMemoryDir(profileId?: string): Promise<string> {
    const resolved = profileId ?? this.activeProfileId
    if (!resolved) throw new Error('No active profile')
    const profile = await this.store.read(resolved)
    return this.resolveProfileScopedDir(resolved, profile.paths.memory)
  }

  async getTrustDir(profileId?: string): Promise<string> {
    const resolved = profileId ?? this.activeProfileId
    if (!resolved) throw new Error('No active profile')
    const profile = await this.store.read(resolved)
    return this.resolveProfileScopedDir(resolved, profile.paths.trust)
  }

  async getActiveProfile(): Promise<Profile | null> {
    const id = this.activeProfileId
    if (!id) return null
    return await this.store.read(id)
  }

  async getProfile(profileId?: string): Promise<Profile> {
    const resolved = profileId ?? this.activeProfileId
    if (!resolved) {
      throw new Error('No active profile')
    }
    return await this.store.read(resolved)
  }

  async list(): Promise<Profile[]> {
    return await this.store.list()
  }

  async create(opts: { name: string; profileId?: string }): Promise<Profile> {
    const profile = await this.store.create({ name: opts.name, profileId: opts.profileId })

    await this.withActiveLock(async () => {
      if (!this.activeProfileId) {
        this.activeProfileId = profile.id
        await this.writeActivePointer(profile.id)
      }
    })

    await this.refreshActiveDirs().catch(() => undefined)

    return profile
  }

  async delete(profileId: string, opts?: { deleteFiles?: boolean }): Promise<void> {
    const deleteFiles = opts?.deleteFiles ?? false
    const root = path.resolve(this.profileRoot)
    const dir = path.resolve(root, profileId)

    const rel = path.relative(root, dir)
    if (!/^[a-z0-9][a-z0-9-_]{2,63}$/.test(profileId) || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Invalid profileId: ${profileId}`)
    }

    if (deleteFiles) {
      await this.store.delete(profileId)
    } else {
      const trashDir = path.join(root, '.trash')
      await fs.mkdir(trashDir, { recursive: true })
      const dest = path.join(trashDir, `${profileId}-${Date.now()}`)
      await fs.rename(dir, dest)
    }

    await this.withActiveLock(async () => {
      if (this.activeProfileId === profileId) {
        const remaining = await this.store.list()
        const next = remaining[0]?.id ?? null
        this.activeProfileId = next
        if (next) {
          await this.writeActivePointer(next)
        } else {
          await fs.unlink(this.activePointerPath()).catch(() => undefined)
        }
      }
    })

    await this.refreshActiveDirs().catch(() => undefined)
  }

  async switch(profileId: string): Promise<Profile> {
    const profile = await this.store.read(profileId)

    await this.withActiveLock(async () => {
      this.activeProfileId = profileId
      await this.writeActivePointer(profileId)
    })

    await this.refreshActiveDirs().catch(() => undefined)

    return profile
  }

  async update(profileId: string, patch: ProfileUpdatePatch): Promise<Profile> {
    const updated = await this.store.update(profileId, current => {
      const nextTrust = {
        ...current.trust,
        ...(patch.trust?.tools ? { tools: patch.trust.tools } : {}),
        ...(patch.trust?.domains ? { domains: patch.trust.domains } : {}),
      }

      if (patch.trust?.defaultTrustLevel !== undefined) {
        nextTrust.defaultTrustLevel = patch.trust.defaultTrustLevel
      }

      const nextLlm = {
        ...current.llm,
        ...(patch.llm ?? {}),
      }

      const next: Profile = {
        ...current,
        updatedAt: Date.now(),
        name: patch.name ?? current.name,
        setupComplete: patch.setupComplete ?? current.setupComplete,
        trust: nextTrust,
        llm: nextLlm,
      }

      return next
    })

    await this.refreshActiveDirs().catch(() => undefined)
    return updated
  }
}
