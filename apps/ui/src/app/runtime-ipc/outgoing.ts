/**
 * Code Map: Outgoing Message Builders
 * - Provides message builder functions for different ActaMessage types
 * 
 * CID Index:
 * CID:outgoing-001 -> buildTaskRequestMessage function
 * CID:outgoing-002 -> buildTaskStopMessage function
 * CID:outgoing-003 -> buildPermissionResponseMessage function
 * CID:outgoing-004 -> buildRequestMessage function
 * 
 * Quick lookup: grep -n "CID:outgoing-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/runtime-ipc/outgoing.ts
 */

import type { ActaMessage, ActaMessageType, TaskRequest, TaskStopRequest } from '@acta/ipc'

/**
 * CID:outgoing-001 - buildTaskRequestMessage Function
 * Purpose: Builds task.request messages for sending to runtime
 * Uses: ActaMessage, TaskRequest types from @acta/ipc
 * Used by: RuntimeIpcCore.sendTaskRequest()
 */
export function buildTaskRequestMessage(opts: {
  id: string
  correlationId: string
  payload: TaskRequest
  profileId?: string
}): ActaMessage<TaskRequest> {
  return {
    id: opts.id,
    type: 'task.request',
    source: 'ui',
    timestamp: Date.now(),
    payload: opts.payload,
    correlationId: opts.correlationId,
    profileId: opts.profileId,
  }
}

/**
 * CID:outgoing-002 - buildTaskStopMessage Function
 * Purpose: Builds task.stop messages for stopping runtime tasks
 * Uses: ActaMessage, TaskStopRequest types from @acta/ipc
 * Used by: RuntimeIpcCore.sendTaskStop()
 */
export function buildTaskStopMessage(opts: {
  id: string
  correlationId: string
  payload: TaskStopRequest
  profileId?: string
}): ActaMessage<TaskStopRequest> {
  return {
    id: opts.id,
    type: 'task.stop',
    source: 'ui',
    timestamp: Date.now(),
    payload: opts.payload,
    correlationId: opts.correlationId,
    profileId: opts.profileId,
  }
}

/**
 * CID:outgoing-003 - buildPermissionResponseMessage Function
 * Purpose: Builds permission.response messages for runtime permission requests
 * Uses: ActaMessage types from @acta/ipc
 * Used by: RuntimeIpcCore.sendPermissionResponse()
 */
export function buildPermissionResponseMessage(opts: {
  id: string
  payload: { requestId: string; decision: 'allow' | 'deny'; remember?: boolean }
  correlationId: string
  profileId?: string
  replyTo: string
}): ActaMessage<typeof opts.payload> {
  return {
    id: opts.id,
    type: 'permission.response',
    source: 'ui',
    timestamp: Date.now(),
    payload: opts.payload,
    correlationId: opts.correlationId,
    profileId: opts.profileId,
    replyTo: opts.replyTo,
  }
}

/**
 * CID:outgoing-004 - buildRequestMessage Function
 * Purpose: Generic message builder for any ActaMessageType
 * Uses: ActaMessage, ActaMessageType types from @acta/ipc
 * Used by: RuntimeIpcCore.request() for generic RPC calls
 */
export function buildRequestMessage<TPayload>(opts: {
  id: string
  type: ActaMessageType
  payload: TPayload
  correlationId: string
  profileId?: string
}): ActaMessage<TPayload> {
  return {
    id: opts.id,
    type: opts.type,
    source: 'ui',
    timestamp: Date.now(),
    payload: opts.payload,
    correlationId: opts.correlationId,
    profileId: opts.profileId,
  }
}
