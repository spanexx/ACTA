/**
 * Code Map: ID Generation Utilities
 * - Provides newId function for generating unique identifiers
 * 
 * CID Index:
 * CID:ids-001 -> newId function
 * 
 * Quick lookup: grep -n "CID:ids-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/runtime-ipc/ids.ts
 */

/**
 * CID:ids-001 - newId Function
 * Purpose: Generates unique identifiers using crypto.randomUUID or fallback
 * Uses: globalThis.crypto API, Date.now(), Math.random()
 * Used by: RuntimeIpcCore, chat state management, message handling, attachments, composer
 */
import { newId as sharedNewId } from '../shared/ids'

export function newId(): string {
  return sharedNewId()
}
