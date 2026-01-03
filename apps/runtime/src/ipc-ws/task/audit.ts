/*
 * Code Map: Audit Logging
 * - appendAuditLog: Writes audit events to file system
 * 
 * CID Index:
 * CID:audit-001 -> appendAuditLog
 * 
 * Quick lookup: rg -n "CID:audit-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/audit.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'

// CID:audit-001 - appendAuditLog
// Purpose: Safely append audit events to a log file in the specified directory
// Uses: Node.js fs/promises, path modules
// Used by: Trust evaluator for permission decisions
export async function appendAuditLog(opts: { logsDir?: string; event: any }): Promise<void> {
  if (!opts.logsDir) return
  try {
    const filePath = path.join(opts.logsDir, 'audit.log')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, JSON.stringify(opts.event) + '\n', 'utf8')
  } catch {
    return
  }
}
