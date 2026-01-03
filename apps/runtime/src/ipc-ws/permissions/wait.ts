/*
 * Code Map: Permission Wait Handler
 * - waitForPermission: Create permission request handler with timeout
 * 
 * CID Index:
 * CID:wait-001 -> waitForPermission
 * 
 * Quick lookup: rg -n "CID:wait-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/wait.ts
 */

import { randomUUID } from 'node:crypto'

import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

import type { PermissionCoordinatorState } from './state'
import { appendAuditLog } from './audit'

// CID:wait-001 - waitForPermission
// Purpose: Create permission request handler with 30s timeout and audit logging
// Uses: Random UUID generation, Promise with timeout, audit logging
// Used by: Permission coordinator core for agent permission requests
export function waitForPermission(
  state: PermissionCoordinatorState,
  opts: { correlationId: string },
): (request: PermissionRequest) => Promise<PermissionDecisionType> {
  return async (request: PermissionRequest) => {
    const requestId = typeof request?.id === 'string' ? request.id : randomUUID()
    const requestKey = `${opts.correlationId}:${requestId}`

    const msgId = state.permissionMsgIdByRequestKey.get(requestKey) ?? randomUUID()
    state.permissionMsgIdByRequestKey.set(requestKey, msgId)

    const existing = state.pendingPermissionByMsgId.get(msgId)
    if (existing) {
      clearTimeout(existing.timeout)
      state.pendingPermissionByMsgId.delete(msgId)
      state.pendingContextByMsgId.delete(msgId)
    }

    return await new Promise<PermissionDecisionType>(resolve => {
      const timeout = setTimeout(() => {
        state.pendingPermissionByMsgId.delete(msgId)
        const pendingCtx = state.pendingContextByMsgId.get(msgId)
        state.pendingContextByMsgId.delete(msgId)

        void appendAuditLog(state, {
          profileId: pendingCtx?.profileId,
          event: {
            type: 'permission.timeout',
            timestamp: Date.now(),
            correlationId: pendingCtx?.correlationId ?? opts.correlationId,
            profileId: pendingCtx?.profileId,
            requestId: pendingCtx?.request?.id,
            tool: pendingCtx?.request?.tool,
            scope: pendingCtx?.request?.scope,
            action: pendingCtx?.request?.action,
            decision: 'deny',
            source: 'prompt',
          },
        })

        resolve('deny')
      }, 30_000)

      state.pendingPermissionByMsgId.set(msgId, { resolve, timeout })
      state.pendingContextByMsgId.set(msgId, {
        request,
        correlationId: opts.correlationId,
        profileId: request.profileId,
      })
    })
  }
}
