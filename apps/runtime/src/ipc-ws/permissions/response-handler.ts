/*
 * Code Map: Permission Response Handler
 * - handlePermissionResponse: Process user permission responses and resolve promises
 * 
 * CID Index:
 * CID:response-handler-001 -> handlePermissionResponse
 * 
 * Quick lookup: rg -n "CID:response-handler-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/response-handler.ts
 */

import { createLogger } from '@acta/logging'
import type { ActaMessage, PermissionResponsePayload } from '@acta/ipc'
import type { PermissionDecisionType } from '@acta/trust'

import type { PermissionCoordinatorState } from './state'
import { appendAuditLog } from './audit'
import { persistRememberedRule } from './rule-persistence'

// CID:response-handler-001 - handlePermissionResponse
// Purpose: Process user permission responses, resolve promises, and persist rules
// Uses: Logging, audit logging, rule persistence, state management
// Used by: Permission coordinator core for handling permission responses
export async function handlePermissionResponse(state: PermissionCoordinatorState, msg: ActaMessage): Promise<void> {
  const logger = createLogger('ipc-ws', state.opts.getLogLevel())
  const payload = msg.payload as PermissionResponsePayload | any

  const replyTo = typeof msg.replyTo === 'string' ? msg.replyTo : undefined
  const requestId = typeof payload?.requestId === 'string' ? payload.requestId : undefined

  let pendingMsgId: string | undefined = replyTo
  if (!pendingMsgId && requestId && typeof msg.correlationId === 'string') {
    const requestKey = `${msg.correlationId}:${requestId}`
    pendingMsgId = state.permissionMsgIdByRequestKey.get(requestKey)
  }

  if (!pendingMsgId) {
    logger.warn('IPC permission.response missing replyTo/requestId', {
      correlationId: msg.correlationId,
    })
    return
  }

  const pending = state.pendingPermissionByMsgId.get(pendingMsgId)
  if (!pending) {
    logger.warn('IPC permission.response has no pending request', {
      replyTo: pendingMsgId,
      correlationId: msg.correlationId,
    })
    return
  }

  const pendingCtx = state.pendingContextByMsgId.get(pendingMsgId)
  state.pendingContextByMsgId.delete(pendingMsgId)

  clearTimeout(pending.timeout)
  state.pendingPermissionByMsgId.delete(pendingMsgId)

  const decisionRaw = payload?.decision
  const decision: PermissionDecisionType = decisionRaw === 'deny' ? 'deny' : 'allow'
  const remember = Boolean(payload?.remember)

  if (pendingCtx?.request) {
    await appendAuditLog(state, {
      profileId: pendingCtx.profileId,
      event: {
        type: 'permission.decision',
        timestamp: Date.now(),
        correlationId: pendingCtx.correlationId ?? msg.correlationId,
        profileId: pendingCtx.profileId,
        requestId: pendingCtx.request.id,
        tool: pendingCtx.request.tool,
        scope: pendingCtx.request.scope,
        action: pendingCtx.request.action,
        decision,
        source: 'prompt',
        remember,
      },
    })

    await persistRememberedRule(state, {
      profileId: pendingCtx.profileId,
      request: pendingCtx.request,
      decision,
      remember,
    })
  }

  logger.info('IPC permission.response resolved', { replyTo: pendingMsgId, decision })
  pending.resolve(decision)
}
