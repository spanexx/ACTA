/*
 * Code Map: Profile Filesystem Paths
 * - profilesRoot(): Root folder for all profiles under Electron userData.
 * - activeProfileStatePath(): Path to persisted active profile JSON.
 * - profileDir(): Per-profile directory.
 * - logsDir(): Per-profile logs directory.
 *
 * CID Index:
 * CID:profile-paths-001 -> profilesRoot
 * CID:profile-paths-002 -> activeProfileStatePath
 * CID:profile-paths-003 -> profileDir
 * CID:profile-paths-004 -> logsDir
 *
 * Lookup: rg -n "CID:profile-paths-" apps/ui/electron/src/main/profile-paths.ts
 */

import { app } from 'electron'
import path from 'node:path'

// CID:profile-paths-001 - Profiles Root
// Purpose: Returns the root directory where all profiles are stored.
// Uses: electron.app.getPath('userData')
// Used by: profiles.service.ts and ipc-handlers.ts for profile enumeration and file operations
export function profilesRoot(): string {
  return path.join(app.getPath('userData'), 'profiles')
}

// CID:profile-paths-002 - Active Profile State Path
// Purpose: Returns the path to the JSON file storing the active profile id.
// Uses: electron.app.getPath('userData')
// Used by: profiles.service.ts (load/persist active profile)
export function activeProfileStatePath(): string {
  return path.join(app.getPath('userData'), 'activeProfile.json')
}

// CID:profile-paths-003 - Profile Directory
// Purpose: Returns the directory path for a given profile id.
// Uses: profilesRoot()
// Used by: profile-config.ts, profiles.service.ts, ipc-handlers.ts
export function profileDir(profileId: string): string {
  return path.join(profilesRoot(), profileId)
}

// CID:profile-paths-004 - Logs Directory
// Purpose: Returns the logs directory path for a given profile id.
// Uses: profileDir()
// Used by: ipc-handlers.ts logsOpenFolder
export function logsDir(profileId: string): string {
  return path.join(profileDir(profileId), 'logs')
}
