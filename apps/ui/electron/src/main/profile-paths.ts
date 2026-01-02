import { app } from 'electron'
import path from 'node:path'

export function profilesRoot(): string {
  return path.join(app.getPath('userData'), 'profiles')
}

export function activeProfileStatePath(): string {
  return path.join(app.getPath('userData'), 'activeProfile.json')
}

export function profileDir(profileId: string): string {
  return path.join(profilesRoot(), profileId)
}

export function logsDir(profileId: string): string {
  return path.join(profileDir(profileId), 'logs')
}
