// Core configuration provider (Phase-1 baseline)
// Provides hierarchical loading: defaults → env → runtime args.
// Uses simple object merging; Zod validation can be added later.

export interface ActaConfig {
  port: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  profileId?: string
  dataDir: string
  ipcHost: string
  ipcPort: number
  ipcPath: string
}

const DEFAULTS: Partial<ActaConfig> = {
  port: 5000,
  logLevel: 'info',
  dataDir: './data',
  ipcHost: '127.0.0.1',
  ipcPort: 48152,
  ipcPath: '/ws',
}

function fromEnv(): Partial<ActaConfig> {
  const cfg: Partial<ActaConfig> = {}
  if (process.env.PORT) cfg.port = Number(process.env.PORT)
  if (process.env.LOG_LEVEL) cfg.logLevel = process.env.LOG_LEVEL as ActaConfig['logLevel']
  if (process.env.ACTA_PROFILE_ID) cfg.profileId = process.env.ACTA_PROFILE_ID
  if (process.env.ACTA_DATA_DIR) cfg.dataDir = process.env.ACTA_DATA_DIR
  if (process.env.ACTA_IPC_HOST) cfg.ipcHost = process.env.ACTA_IPC_HOST
  if (process.env.ACTA_IPC_PORT) cfg.ipcPort = Number(process.env.ACTA_IPC_PORT)
  if (process.env.ACTA_IPC_PATH) cfg.ipcPath = process.env.ACTA_IPC_PATH
  return cfg
}

export function loadConfig(): ActaConfig {
  const merged = { ...DEFAULTS, ...fromEnv() }
  // Basic validation; replace with Zod later if desired
  const port = Number(merged.port)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${merged.port}`)
  }

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
  return { ...merged, port, ipcPort } as ActaConfig
}
