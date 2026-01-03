/*
 * Code Map: Core Configuration Provider
 * - ActaConfig interface: Shape of merged runtime config
 * - defaultProfileRoot: Resolve platform-specific default profile path
 * - normalizeProfileRoot: Expand tilde and resolve path
 * - DEFAULTS constant: Baseline config values
 * - fromEnv: Read overrides from environment variables
 * - loadConfig: Merge defaults/env, validate, normalize
 *
 * CID Index:
 * CID:core-config-001 -> ActaConfig interface
 * CID:core-config-002 -> defaultProfileRoot function
 * CID:core-config-003 -> normalizeProfileRoot function
 * CID:core-config-004 -> DEFAULTS constant
 * CID:core-config-005 -> fromEnv function
 * CID:core-config-006 -> loadConfig function
 *
 * Quick lookup: rg -n "CID:core-config-" /home/spanexx/Shared/Projects/ACTA/packages/core/src/config.ts
 */

import os from 'node:os'
import path from 'node:path'

// CID:core-config-001 - ActaConfig interface
// Purpose: Define runtime configuration contract exposed by loadConfig
export interface ActaConfig {
  port: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  profileId?: string
  dataDir: string
  profileRoot: string
  ipcHost: string
  ipcPort: number
  ipcPath: string
}

// CID:core-config-002 - defaultProfileRoot
// Purpose: Derive platform-specific default profile directory
function defaultProfileRoot(): string {
  const home = os.homedir()

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
    return path.join(appData, 'ACTA', 'profiles')
  }

  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'ACTA', 'profiles')
  }

  const xdgDataHome = process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share')
  return path.join(xdgDataHome, 'acta', 'profiles')
 }

// CID:core-config-003 - normalizeProfileRoot
// Purpose: Resolve profile root path, expanding tilde when necessary
function normalizeProfileRoot(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.resolve(os.homedir(), trimmed.slice(2))
  }
  return path.resolve(trimmed)
 }

// CID:core-config-004 - DEFAULTS
// Purpose: Baseline configuration before env overrides
const DEFAULTS: Partial<ActaConfig> = {
  port: 5000,
  logLevel: 'info',
  dataDir: './data',
  profileRoot: defaultProfileRoot(),
  ipcHost: '127.0.0.1',
  ipcPort: 48152,
  ipcPath: '/ws',
}

// CID:core-config-005 - fromEnv
// Purpose: Collect environment overrides for config
function fromEnv(): Partial<ActaConfig> {
  const cfg: Partial<ActaConfig> = {}
  if (process.env.PORT) cfg.port = Number(process.env.PORT)
  if (process.env.LOG_LEVEL) cfg.logLevel = process.env.LOG_LEVEL as ActaConfig['logLevel']
  if (process.env.ACTA_PROFILE_ID) cfg.profileId = process.env.ACTA_PROFILE_ID
  if (process.env.ACTA_DATA_DIR) cfg.dataDir = process.env.ACTA_DATA_DIR
  if (process.env.ACTA_PROFILE_ROOT) cfg.profileRoot = process.env.ACTA_PROFILE_ROOT
  if (process.env.ACTA_IPC_HOST) cfg.ipcHost = process.env.ACTA_IPC_HOST
  if (process.env.ACTA_IPC_PORT) cfg.ipcPort = Number(process.env.ACTA_IPC_PORT)
  if (process.env.ACTA_IPC_PATH) cfg.ipcPath = process.env.ACTA_IPC_PATH
  return cfg
}

// CID:core-config-006 - loadConfig
// Purpose: Merge defaults/env vars and validate configuration
export function loadConfig(): ActaConfig {
  const merged = { ...DEFAULTS, ...fromEnv() }
  // Basic validation; replace with Zod later if desired
  const port = Number(merged.port)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${merged.port}`)
  }

  if (!merged.profileRoot || typeof merged.profileRoot !== 'string' || !merged.profileRoot.trim()) {
    throw new Error(`Invalid profileRoot: ${merged.profileRoot}`)
  }
  const profileRoot = normalizeProfileRoot(merged.profileRoot)

  const ipcPort = Number(merged.ipcPort)
  if (isNaN(ipcPort) || ipcPort < 1 || ipcPort > 65535) {
    throw new Error(`Invalid ipcPort: ${merged.ipcPort}`)
  }

  if (!merged.ipcHost || typeof merged.ipcHost !== 'string') {
    throw new Error(`Invalid ipcHost: ${merged.ipcHost}`)
  }

  const allowedIpcHosts = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1'])
  if (!allowedIpcHosts.has(merged.ipcHost)) {
    throw new Error(`Invalid ipcHost (must be local-only): ${merged.ipcHost}`)
  }

  if (!merged.ipcPath || typeof merged.ipcPath !== 'string' || !merged.ipcPath.startsWith('/')) {
    throw new Error(`Invalid ipcPath: ${merged.ipcPath}`)
  }

  const validLevels: ActaConfig['logLevel'][] = ['debug', 'info', 'warn', 'error']
  if (!merged.logLevel || !validLevels.includes(merged.logLevel)) {
    throw new Error(`Invalid logLevel: ${merged.logLevel}`)
  }
  return { ...merged, port, ipcPort, profileRoot } as ActaConfig
}
