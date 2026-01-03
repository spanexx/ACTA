/*
 * Code Map: Logging Package
 * - LOGGING_VERSION constant
 * - LogLevel/LogEntry/Logger interfaces
 * - Directory provider management (setLogDirectoryProvider / setLogDirectory)
 * - Helpers: shouldLog, formatEntry, safeFileComponent, writeFileLine
 * - createLogger factory
 * - Audit helpers (AuditEvent, logAudit)
 *
 * CID Index:
 * CID:logging-001 -> LOGGING_VERSION constant
 * CID:logging-002 -> LogLevel type
 * CID:logging-003 -> LogEntry interface
 * CID:logging-004 -> Logger interface
 * CID:logging-005 -> setLogDirectoryProvider
 * CID:logging-006 -> setLogDirectory
 * CID:logging-007 -> shouldLog helper
 * CID:logging-008 -> formatEntry helper
 * CID:logging-009 -> safeFileComponent helper
 * CID:logging-010 -> writeFileLine helper
 * CID:logging-011 -> createLogger
 * CID:logging-012 -> AuditEvent interface
 * CID:logging-013 -> logAudit helper
 *
 * Quick lookup: rg -n "CID:logging-" /home/spanexx/Shared/Projects/ACTA/packages/logging/src/index.ts
 */

export const LOGGING_VERSION = "0.1.0"

import fs from 'node:fs'
import path from 'node:path'

// CID:logging-002 - LogLevel type
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// CID:logging-003 - LogEntry interface
export interface LogEntry {
  timestamp: number
  level: LogLevel
  scope: string
  message: string
  meta?: any
}

// CID:logging-004 - Logger interface
export interface Logger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
}

let logDirProvider: (() => string | null) | null = null

// CID:logging-005 - setLogDirectoryProvider
export function setLogDirectoryProvider(provider: (() => string | null) | null): void {
  logDirProvider = provider
}

// CID:logging-006 - setLogDirectory
export function setLogDirectory(dir: string | null): void {
  if (!dir) {
    logDirProvider = null
    return
  }
  logDirProvider = () => dir
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

// CID:logging-007 - shouldLog helper
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[minLevel]
}

// CID:logging-008 - formatEntry helper
function formatEntry(entry: LogEntry): string {
  const ts = new Date(entry.timestamp).toISOString()
  const scope = entry.scope ? `[${entry.scope}]` : ''
  return `${ts} ${entry.level.toUpperCase()} ${scope} ${entry.message}`.trim()
}

// CID:logging-009 - safeFileComponent helper
function safeFileComponent(input: string): string {
  const s = (input ?? '').toString().trim().toLowerCase()
  const cleaned = s.replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.length ? cleaned : 'log'
}

// CID:logging-010 - writeFileLine helper
function writeFileLine(explicitDir: string | null | undefined, scope: string, line: string, meta?: any): void {
  let dir = (explicitDir ?? '').trim()
  if (!dir.length) {
    const provider = logDirProvider
    if (!provider) return
    dir = (provider() ?? '').trim()
    if (!dir.length) return
  }

  const filePath = path.join(dir, `${safeFileComponent(scope)}.log`)

  try {
    fs.mkdirSync(dir, { recursive: true })
    const suffix = meta === undefined ? '' : ` ${JSON.stringify(meta)}`
    fs.appendFileSync(filePath, `${line}${suffix}\n`, 'utf8')
  } catch {
    return
  }
}

// CID:logging-011 - createLogger
export function createLogger(scope: string, minLevel?: LogLevel): Logger
export function createLogger(scope: string, minLevel: LogLevel, opts?: { dir?: string | null }): Logger
export function createLogger(scope: string, minLevel: LogLevel = 'info', opts?: { dir?: string | null }): Logger {
  const fixedDir = opts?.dir ?? undefined
  const log = (level: LogLevel, message: string, meta?: any) => {
    if (!shouldLog(level, minLevel)) return
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      scope,
      message,
      meta,
    }
    const line = formatEntry(entry)
    writeFileLine(fixedDir, scope, line, meta)
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(line, meta ?? '')
    } else if (level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(line, meta ?? '')
    } else {
      // eslint-disable-next-line no-console
      console.log(line, meta ?? '')
    }
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  }
}

// Minimal audit event helper for Phase-1
// CID:logging-012 - AuditEvent
export interface AuditEvent {
  type: string
  timestamp: number
  profileId?: string
  userId?: string
  tool?: string
  decision?: string
  details?: any
}

// CID:logging-013 - logAudit
export function logAudit(logger: Logger, event: AuditEvent): void {
  logger.info(`audit:${event.type}`, {
    ...event,
  })
}

