/*
 * Code Map: Agent Event Adapter
 * - createAgentEventAdapter: Create event adapter for agent-to-IPC communication
 * 
 * CID Index:
 * CID:agent-adapter-001 -> createAgentEventAdapter
 * 
 * Quick lookup: rg -n "CID:agent-adapter-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/agent-adapter.ts
 */

import { randomUUID } from 'node:crypto'

import type { ActaMessage } from '@acta/ipc'
import type { PermissionRequest } from '@acta/trust'

import type { PermissionCoordinatorState } from './state'
import { appendAuditLog } from './audit'

// CID:agent-adapter-001 - createAgentEventAdapter
// Purpose: Create event adapter for agent events including permission requests
// Uses: Random UUID generation, message broadcasting, audit logging
// Used by: Permission coordinator core for agent event handling
export function createAgentEventAdapter(
  state: PermissionCoordinatorState,
  opts: { correlationId: string; profileId: string; taskId: string },
): (type: string, payload: any) => void {
  return (type: string, payload: any) => {
    switch (type) {
      case 'task.plan':
        state.opts.emitMessage('task.plan', payload, {
          correlationId: opts.correlationId,
          profileId: opts.profileId,
        })
        return
      case 'task.step':
        state.opts.emitMessage('task.step', payload, {
          correlationId: opts.correlationId,
          profileId: opts.profileId,
        })
        return
      case 'permission.request': {
        const req = payload as PermissionRequest
        const requestId = typeof req?.id === 'string' ? req.id : randomUUID()
        const requestKey = `${opts.correlationId}:${requestId}`

        const msgId = randomUUID()
        state.permissionMsgIdByRequestKey.set(requestKey, msgId)

        const msg: ActaMessage<PermissionRequest> = {
          id: msgId,
          type: 'permission.request',
          source: 'agent',
          timestamp: Date.now(),
          payload: req,
          correlationId: opts.correlationId,
          profileId: opts.profileId,
        }

        state.opts.broadcast(msg)

        state.pendingContextByMsgId.set(msgId, {
          request: req,
          correlationId: opts.correlationId,
          profileId: opts.profileId,
        })

        void appendAuditLog(state, {
          profileId: opts.profileId,
          event: {
            type: 'permission.request',
            timestamp: Date.now(),
            correlationId: opts.correlationId,
            profileId: opts.profileId,
            requestId,
            tool: req?.tool,
            scope: req?.scope,
            action: req?.action,
            reason: req?.reason,
            source: 'prompt',
          },
        })

        return
      }
      case 'task.result':
        state.opts.emitMessage('task.result', payload, {
          correlationId: opts.correlationId,
          profileId: opts.profileId,
        })
        return
      case 'task.error':
        state.opts.emitMessage(
          'task.error',
          { taskId: opts.taskId, ...(payload ?? {}) },
          {
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          },
        )
        return
      default:
        return
    }
  }
}
