// IPC request validator stub (Phase-1)
// Provides runtime type guards; can be swapped for Zod later

import type { ActaMessage, ActaMessageType } from './types'

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

function isValidMessageType(type: unknown): type is ActaMessageType {
  const valid: ActaMessageType[] = [
    'task.request',
    'task.plan',
    'task.step',
    'task.permission',
    'task.result',
    'task.error',
    'memory.read',
    'memory.write',
    'trust.prompt',
    'system.event',
  ]
  return typeof type === 'string' && valid.includes(type as ActaMessageType)
}

function isValidSource(source: unknown): source is 'ui' | 'agent' | 'tool' | 'system' {
  const valid = ['ui', 'agent', 'tool', 'system']
  return typeof source === 'string' && valid.includes(source)
}

// Stub: validate a specific message type payload (no-op for now)
export function validatePayload(type: ActaMessageType, payload: unknown): boolean {
  // Phase-1: accept any payload; later add per-type schemas
  return true
}
