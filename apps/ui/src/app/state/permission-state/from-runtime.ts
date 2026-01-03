/**
 * Code Map: Runtime Permission Request Parser
 * - Provides permissionRequestFromRuntime function for parsing IPC permission messages
 * 
 * CID Index:
 * CID:from-runtime-001 -> permissionRequestFromRuntime function
 * 
 * Quick lookup: grep -n "CID:from-runtime-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/permission-state/from-runtime.ts
 */

import type { ActaMessage } from '@acta/ipc'
import type { PermissionRequestEvent } from '../../models/ui.models'

/**
 * CID:from-runtime-001 - permissionRequestFromRuntime Function
 * Purpose: Parses runtime IPC permission.request messages into UI PermissionRequestEvent
 * Uses: ActaMessage from @acta/ipc, PermissionRequestEvent from ui.models
 * Used by: PermissionStateService for handling incoming permission requests
 */
export function permissionRequestFromRuntime(
  msg: ActaMessage,
): { req: PermissionRequestEvent; now: number } | null {
  if (msg.type !== 'permission.request') return null

  const now = Date.now()
  const correlationId = typeof msg.correlationId === 'string' ? msg.correlationId : undefined
  if (!correlationId) return null

  const p = msg.payload as any
  const cloud =
    p?.cloud && typeof p.cloud === 'object'
      ? {
          provider: String((p.cloud as any).provider ?? ''),
          model: typeof (p.cloud as any).model === 'string' ? ((p.cloud as any).model as string) : undefined,
          warning: typeof (p.cloud as any).warning === 'string' ? ((p.cloud as any).warning as string) : undefined,
        }
      : undefined

  const req: PermissionRequestEvent = {
    id: msg.id,
    requestId: typeof p?.id === 'string' ? p.id : msg.id,
    correlationId,
    replyTo: msg.id,
    tool: String(p?.tool ?? 'tool'),
    action: typeof p?.action === 'string' ? p.action : undefined,
    scope: typeof p?.scope === 'string' ? p.scope : undefined,
    input: typeof p?.input === 'string' ? p.input : undefined,
    output: typeof p?.output === 'string' ? p.output : undefined,
    reason: String(p?.reason ?? 'Permission required'),
    risk: typeof p?.risk === 'string' ? p.risk : undefined,
    risks: Array.isArray(p?.risks) ? p.risks.map((r: any) => String(r)) : undefined,
    reversible: Boolean(p?.reversible ?? true),
    rememberDecision: true,
    cloud: cloud && cloud.provider.trim().length ? cloud : undefined,
  }

  return { req, now }
}
