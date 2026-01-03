/*
 * Code Map: IPC Error Handling
 * - sendIpcError: Sends structured error messages over WebSocket
 * 
 * CID Index:
 * CID:ipc-error-001 -> sendIpcError
 * 
 * Quick lookup: rg -n "CID:ipc-error-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/server/ipc-error.ts
 */

import { randomUUID } from 'node:crypto'
import { WebSocket } from 'ws'
import { createLogger } from '@acta/logging'
import type { ActaMessage, TaskErrorPayload } from '@acta/ipc'

// CID:ipc-error-001 - sendIpcError
// Purpose: Send structured error response over WebSocket with proper normalization
// Uses: Node crypto, WebSocket, logging, Acta message types
// Used by: Runtime core server and transport layer for error reporting
export function sendIpcError(opts: {
  ws: WebSocket
  payload: TaskErrorPayload
  context?: ActaMessage
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}): void {
  const logger = createLogger('ipc-ws', opts.logLevel)
  logger.warn('IPC rejecting message', opts.payload)

  const normalized: TaskErrorPayload = {
    taskId:
      typeof opts.payload?.taskId === 'string'
        ? opts.payload.taskId
        : typeof opts.context?.id === 'string'
          ? opts.context.id
          : 'unknown',
    code: opts.payload.code,
    message: opts.payload.message,
    stepId: (opts.payload as any)?.stepId,
    details: (opts.payload as any)?.details,
  }

  const reply: ActaMessage<TaskErrorPayload> = {
    id: randomUUID(),
    type: 'task.error',
    source: 'system',
    timestamp: Date.now(),
    payload: normalized,
    correlationId: opts.context?.correlationId,
    replyTo: opts.context?.id,
    profileId: opts.context?.profileId,
  }

  if (opts.ws.readyState === WebSocket.OPEN) opts.ws.send(JSON.stringify(reply))
}
