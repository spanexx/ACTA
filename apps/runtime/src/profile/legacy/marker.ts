import fs from 'node:fs/promises'
import path from 'node:path'

export function legacyMigrationMarkerPath(profileRoot: string): string {
  return path.join(path.resolve(profileRoot), 'legacyMigration.json')
}

export async function hasLegacyMigrationMarker(profileRoot: string): Promise<boolean> {
  try {
    await fs.stat(legacyMigrationMarkerPath(profileRoot))
    return true
  } catch {
    return false
  }
}

export async function writeLegacyMigrationMarker(
  profileRoot: string,
  payload: { legacyProfilesRoot: string; completedAt: number },
): Promise<void> {
  const body = JSON.stringify(payload, null, 2) + '\n'
  await fs.writeFile(legacyMigrationMarkerPath(profileRoot), body, 'utf8')
}
