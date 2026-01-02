// Core configuration provider (Phase-1 baseline)
// Provides hierarchical loading: defaults → env → runtime args.
// Uses simple object merging; Zod validation can be added later.

export interface ActaConfig {
  port: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  profileId?: string
  dataDir: string
}

const DEFAULTS: Partial<ActaConfig> = {
  port: 5000,
  logLevel: 'info',
  dataDir: './data',
}

function fromEnv(): Partial<ActaConfig> {
  const cfg: Partial<ActaConfig> = {}
  if (process.env.PORT) cfg.port = Number(process.env.PORT)
  if (process.env.LOG_LEVEL) cfg.logLevel = process.env.LOG_LEVEL as ActaConfig['logLevel']
  if (process.env.ACTA_PROFILE_ID) cfg.profileId = process.env.ACTA_PROFILE_ID
  if (process.env.ACTA_DATA_DIR) cfg.dataDir = process.env.ACTA_DATA_DIR
  return cfg
}

export function loadConfig(): ActaConfig {
  const merged = { ...DEFAULTS, ...fromEnv() }
  // Basic validation; replace with Zod later if desired
  const port = Number(merged.port)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${merged.port}`)
  }
  const validLevels: ActaConfig['logLevel'][] = ['debug', 'info', 'warn', 'error']
  if (!merged.logLevel || !validLevels.includes(merged.logLevel)) {
    throw new Error(`Invalid logLevel: ${merged.logLevel}`)
  }
  return { ...merged, port } as ActaConfig
}
