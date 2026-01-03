/**
 * Code Map: Incoming Message Parser
 * - Provides parseIncomingActaMessage function for validating incoming IPC messages
 * 
 * CID Index:
 * CID:incoming-001 -> parseIncomingActaMessage function
 * 
 * Quick lookup: grep -n "CID:incoming-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/runtime-ipc/incoming.ts
 */

import { isValidActaMessage, validatePayload, type ActaMessage } from '@acta/ipc'

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
    return null
  }

  if (!isValidActaMessage(parsed)) return null
  if (!validatePayload(parsed.type, parsed.payload)) return null

  return parsed
}
