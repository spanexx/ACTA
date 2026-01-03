/*
 * Code Map: WebSocket Message Utilities
 * - decodeWsMessageData: Normalize WS data payloads into UTF-8 strings
 * - parseIncomingActaMessage: Validate and parse incoming Acta messages
 *
 * CID Index:
 * CID:ws-message-util-001 -> decodeWsMessageData
 * CID:ws-message-util-002 -> parseIncomingActaMessage
 *
 * Quick lookup: rg -n "CID:ws-message-util-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/ws-message.util.ts
 */

import {
  isValidActaMessage,
  validatePayload,
  validatePayloadDetailed,
  type ActaMessage,
  type TaskErrorPayload,
} from '@acta/ipc'

// CID:ws-message-util-001 - decodeWsMessageData
// Purpose: Convert various WS binary/text payload shapes into UTF-8 strings
// Uses: Buffer conversion, ArrayBuffer handling
// Used by: ws-transport for logging and parsing incoming frames
export function decodeWsMessageData(data: unknown): string {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  if (Array.isArray(data)) {
    const buffers = data.filter(Buffer.isBuffer) as Buffer[]
    if (buffers.length) return Buffer.concat(buffers).toString('utf8')
  }
  return ''
}

export type ParsedIncomingMessage =
  | { ok: true; msg: ActaMessage }
  | { ok: false; error: TaskErrorPayload; context?: ActaMessage }

// CID:ws-message-util-002 - parseIncomingActaMessage
// Purpose: Parse JSON payload, validate Acta envelope and payload, return structured result
// Uses: JSON parsing, @acta/ipc validation helpers
// Used by: ws-transport when processing inbound messages
export function parseIncomingActaMessage(text: string): ParsedIncomingMessage {
  if (!text.length) {
    return {
      ok: false,
      error: {
        taskId: 'unknown',
        code: 'ipc.invalid_message',
        message: 'Empty WebSocket message payload',
      },
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      ok: false,
      error: {
        taskId: 'unknown',
        code: 'ipc.invalid_json',
        message: 'Message must be valid JSON',
      },
    }
  }

  if (!isValidActaMessage(parsed)) {
    return {
      ok: false,
      error: {
        taskId: 'unknown',
        code: 'ipc.invalid_message',
        message: 'Message must match ActaMessage envelope',
      },
    }
  }

  if (!validatePayload(parsed.type, parsed.payload)) {
    const detail = validatePayloadDetailed(parsed.type, parsed.payload)
    if (!detail.ok) {
      return {
        ok: false,
        error: {
          taskId: typeof parsed.id === 'string' ? parsed.id : 'unknown',
          code: detail.code,
          message: detail.message,
        },
        context: parsed,
      }
    }

    return {
      ok: false,
      error: {
        taskId: typeof parsed.id === 'string' ? parsed.id : 'unknown',
        code: 'ipc.invalid_payload',
        message: `Invalid payload for message type ${parsed.type}`,
      },
      context: parsed,
    }
  }

  return { ok: true, msg: parsed }
}
