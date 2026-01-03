/**
 * Code Map: Incoming Message Parser
 * - Provides parseIncomingActaMessage function for validating incoming IPC messages
 * 
 * CID Index:
 * CID:incoming-001 -> parseIncomingActaMessage function
 * 
 * Quick lookup: grep -n "CID:incoming-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/runtime-ipc/incoming.ts
 */

import { validatePayload, type ActaMessage } from '@acta/ipc'

function isValidSource(source: unknown): source is 'ui' | 'agent' | 'tool' | 'system' {
  return source === 'ui' || source === 'agent' || source === 'tool' || source === 'system'
}

function isValidMessageType(type: unknown): boolean {
  if (typeof type !== 'string') return false
  const valid = [
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
  return valid.includes(type)
}

function isActaMessageEnvelope(msg: unknown): msg is ActaMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as any
  if (typeof m.id !== 'string') return false
  if (!isValidMessageType(m.type)) return false
  if (!isValidSource(m.source)) return false
  if (typeof m.timestamp !== 'number') return false
  if (!('payload' in m)) return false
  return true
}

/**
 * CID:incoming-001 - parseIncomingActaMessage Function
 * Purpose: Parses and validates incoming WebSocket data as ActaMessage
 * Uses: isValidActaMessage, validatePayload from @acta/ipc, JSON.parse
 * Used by: RuntimeIpcCore WebSocket onmessage handler
 */
export function parseIncomingActaMessage(data: unknown): ActaMessage | null {
  const text = typeof data === 'string' ? data : ''
  if (!text.length) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn('[UI Runtime IPC] Dropping invalid JSON message')
    return null
  }

  if (!isActaMessageEnvelope(parsed)) {
    const isObj = typeof parsed === 'object' && parsed !== null
    const obj = isObj ? (parsed as any) : null
    console.warn('[UI Runtime IPC] Dropping invalid ActaMessage envelope', {
      topLevelType: typeof parsed,
      keys: isObj ? Object.keys(obj) : undefined,
      idType: isObj ? typeof obj.id : undefined,
      typeType: isObj ? typeof obj.type : undefined,
      typeValue: isObj && typeof obj.type === 'string' ? obj.type : undefined,
      sourceType: isObj ? typeof obj.source : undefined,
      sourceValue: isObj && typeof obj.source === 'string' ? obj.source : undefined,
      timestampType: isObj ? typeof obj.timestamp : undefined,
      hasPayload: isObj ? 'payload' in obj : undefined,
    })
    return null
  }

  if (!validatePayload(parsed.type as any, (parsed as any).payload)) {
    console.warn('[UI Runtime IPC] Dropping invalid payload', {
      type: (parsed as any).type,
      payloadType: typeof (parsed as any).payload,
      payloadKeys:
        (parsed as any).payload && typeof (parsed as any).payload === 'object' && !Array.isArray((parsed as any).payload)
          ? Object.keys((parsed as any).payload as Record<string, unknown>)
          : undefined,
    })
    return null
  }

  return parsed
}
