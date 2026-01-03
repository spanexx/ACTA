import fs from 'node:fs/promises'
import path from 'node:path'

export async function readLegacyActiveProfileId(legacyProfilesRoot: string): Promise<string | null> {
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

export async function resolveLegacyProfilesRoot(): Promise<string | null> {
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
