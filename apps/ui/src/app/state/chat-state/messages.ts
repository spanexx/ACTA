/**
 * Code Map: Chat Message Factory
 * - Provides makeMessage function for creating ChatMessage objects
 * 
 * CID Index:
 * CID:messages-001 -> makeMessage function
 * 
 * Quick lookup: grep -n "CID:messages-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/chat-state/messages.ts
 */

import type { ChatMessage, ChatMessageLane, ChatMessageType } from '../../models/ui.models'
import { newId } from '../../shared/ids'

/**
 * CID:messages-001 - makeMessage Function
 * Purpose: Creates ChatMessage objects with unique IDs
 * Uses: ChatMessage, ChatMessageType types from ui.models, newId from shared ids
 * Used by: Chat state modules for creating system and user messages
 */
export function makeMessage(type: ChatMessageType, text: string, timestamp: number, lane?: ChatMessageLane): ChatMessage {
  return {
    id: newId(),
    type,
    timestamp,
    text,
    lane,
  }
}
