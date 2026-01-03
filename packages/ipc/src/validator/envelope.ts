/*
 * Code Map: IPC Envelope Validation
 * - isValidMessageType: Guard for supported ActaMessageType strings.
 * - isValidSource: Guard for message source field.
 * - isValidActaMessage: Envelope validator for ActaMessage.
 *
 * CID Index:
 * CID:ipc-validator-envelope-001 -> isValidMessageType
 * CID:ipc-validator-envelope-002 -> isValidSource
 * CID:ipc-validator-envelope-003 -> isValidActaMessage
 *
 * Quick lookup: rg -n "CID:ipc-validator-envelope-" packages/ipc/src/validator/envelope.ts
 */

import type { ActaMessage, ActaMessageType } from '../types'

// CID:ipc-validator-envelope-001 - isValidMessageType
// Purpose: Ensure incoming type strings match the supported IPC message type union.
// Uses: Local allowlist of ActaMessageType values.
// Used by: isValidActaMessage.
export function isValidMessageType(type: unknown): type is ActaMessageType {
  const valid: ActaMessageType[] = [
    'task.request',
    'task.stop',
    'task.plan',
    'task.step',
    'task.permission',
    'permission.request',
    'permission.response',
    'llm.healthCheck',
    'profile.list',
    'profile.create',
    'profile.delete',
    'profile.switch',
    'profile.active',
    'profile.get',
    'profile.update',
    'task.result',
    'task.error',
    'chat.request',
    'chat.response',
    'chat.error',
    'memory.read',
    'memory.write',
    'trust.prompt',
    'system.event',
  ]
  return typeof type === 'string' && valid.includes(type as ActaMessageType)
}

// CID:ipc-validator-envelope-002 - isValidSource
// Purpose: Validate the envelope source field.
// Uses: Allowlist of known source strings.
// Used by: isValidActaMessage.
export function isValidSource(source: unknown): source is 'ui' | 'agent' | 'tool' | 'system' {
  const valid = ['ui', 'agent', 'tool', 'system']
  return typeof source === 'string' && valid.includes(source)
}

// CID:ipc-validator-envelope-003 - isValidActaMessage
// Purpose: Envelope guard for ActaMessage (shape + message type + source).
// Uses: isValidMessageType, isValidSource.
// Used by: WS parsers and broadcast validation.
export function isValidActaMessage(msg: unknown): msg is ActaMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof (msg as any).id === 'string' &&
    isValidMessageType((msg as any).type) &&
    isValidSource((msg as any).source) &&
    typeof (msg as any).timestamp === 'number' &&
    'payload' in (msg as any)
  )
}
