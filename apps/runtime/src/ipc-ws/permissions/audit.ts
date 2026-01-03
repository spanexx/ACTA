/*
 * Code Map: Permission Audit Logging
 * - appendAuditLog: Append permission events to audit log file
 * 
 * CID Index:
 * CID:audit-001 -> appendAuditLog
 * 
 * Quick lookup: rg -n "CID:audit-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/audit.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import type { PermissionCoordinatorState } from './state'

// CID:audit-001 - appendAuditLog
// Purpose: Append permission events to audit log file for profile
// Uses: Node fs/promises, path modules, PermissionCoordinatorState
// Used by: Agent adapter, response handler, wait handler for audit trail
export async function appendAuditLog(state: PermissionCoordinatorState, opts: { profileId?: string; event: any }): Promise<void> {
  const profileId = opts.profileId
  if (!profileId || !state.opts.getLogsDir) return

  try {
    const logsDir = await state.opts.getLogsDir(profileId)
    const filePath = path.join(logsDir, 'audit.log')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.appendFile(filePath, JSON.stringify(opts.event) + '\n', 'utf8')
  } catch {
    return
  }
}
