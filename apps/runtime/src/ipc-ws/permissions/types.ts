/*
 * Code Map: Permission System Types
 * - LogLevel: Log level enumeration
 * - PendingPermission: Promise wrapper for permission decisions
 * - PendingPermissionContext: Context for pending permission requests
 * - PermissionCoordinatorOptions: Configuration for permission coordinator
 * 
 * CID Index:
 * CID:types-001 -> LogLevel type
 * CID:types-002 -> PendingPermission type
 * CID:types-003 -> PendingPermissionContext type
 * CID:types-004 -> PermissionCoordinatorOptions type
 * 
 * Quick lookup: rg -n "CID:types-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/types.ts
 */

import type { ActaMessage, ActaMessageType } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

// CID:types-001 - LogLevel type
// Purpose: Enumeration of supported log levels
// Uses: String literal types for logging configuration
// Used by: Permission coordinator and handlers for logging
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// CID:types-002 - PendingPermission type
// Purpose: Promise wrapper with timeout for permission decisions
// Uses: Promise resolve function and timeout handle
// Used by: Permission coordinator state management
export type PendingPermission = {
  resolve: (decision: PermissionDecisionType) => void
  timeout: ReturnType<typeof setTimeout>
}

// CID:types-003 - PendingPermissionContext type
// Purpose: Context information for pending permission requests
// Uses: Permission request and correlation identifiers
// Used by: Permission coordinator for audit and response handling
export type PendingPermissionContext = {
  request: PermissionRequest
  correlationId?: string
  profileId?: string
}

// CID:types-004 - PermissionCoordinatorOptions type
// Purpose: Configuration interface for permission coordinator
// Uses: Message broadcasting, logging, directory access functions
// Used by: Permission coordinator initialization
export type PermissionCoordinatorOptions = {
  getLogLevel: () => LogLevel
  broadcast: (msg: ActaMessage) => void
  emitMessage: <T>(
    type: ActaMessageType,
    payload: T,
    opts: { correlationId?: string; profileId?: string; replyTo?: string; source?: ActaMessage['source'] },
  ) => void
  getLogsDir?: (profileId: string) => Promise<string>
  getTrustDir?: (profileId: string) => Promise<string>
}
