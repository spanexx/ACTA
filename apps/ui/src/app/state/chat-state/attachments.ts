/**
 * Code Map: File Attachment Utilities
 * - Provides buildAttachments function for converting FileList to Attachment array
 * - Provides attachmentNotice function for generating attachment count messages
 * 
 * CID Index:
 * CID:attachments-001 -> buildAttachments function
 * CID:attachments-002 -> attachmentNotice function
 * 
 * Quick lookup: grep -n "CID:attachments-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/chat-state/attachments.ts
 */

import type { Attachment } from '../../models/ui.models'
import { newId } from '../../shared/ids'

/**
 * CID:attachments-001 - buildAttachments Function
 * Purpose: Converts FileList to Attachment array with unique IDs
 * Uses: Attachment type from ui.models, newId from shared ids
 * Used by: ChatStateService for handling file uploads
 */
export function buildAttachments(files: FileList | null): Attachment[] {
  if (!files || files.length === 0) return []

  return Array.from(files).map(file => {
    const maybePath = (file as File & { path?: string }).path
    return {
      id: newId(),
      name: file.name,
      size: file.size,
      path: maybePath,
    }
  })
}

/**
 * CID:attachments-002 - attachmentNotice Function
 * Purpose: Generates user-facing message for attachment count
 * Uses: Simple string interpolation
 * Used by: ChatStateService for displaying attachment notices
 */
export function attachmentNotice(count: number): string {
  return `Attached ${count} file${count === 1 ? '' : 's'}. Permission may be required to read it.`
}
