/**
 * Code Map: Chat State ID Wrapper
 * - Provides newId wrapper function delegating to shared implementation
 * 
 * CID Index:
 * CID:chat-ids-001 -> newId wrapper function
 * 
 * Quick lookup: grep -n "CID:chat-ids-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/chat-state/ids.ts
 */

import { newId as sharedNewId } from '../../shared/ids'

/**
 * CID:chat-ids-001 - newId Wrapper Function
 * Purpose: Wrapper that delegates to shared newId implementation
 * Uses: sharedNewId from ../../shared/ids
 * Used by: Chat state modules for backward compatibility
 */
export function newId(): string {
  return sharedNewId()
}
