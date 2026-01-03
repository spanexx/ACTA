/**
 * Code Map: Pending Request Management
 * - Provides PendingRequests class for tracking request/response pairs
 * 
 * CID Index:
 * CID:pending-001 -> PendingRequests class
 * CID:pending-002 -> resolveIfPending method
 * CID:pending-003 -> waitForReply method
 * CID:pending-004 -> clear method
 * 
 * Quick lookup: grep -n "CID:pending-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/runtime-ipc/pending.ts
 */

import type { ActaMessage } from '@acta/ipc'

/**
 * CID:pending-001 - PendingRequests Class
 * Purpose: Manages pending request/response pairs with timeout handling
 * Uses: ActaMessage type from @acta/ipc, Map for storage
 * Used by: RuntimeIpcCore for request/response orchestration
 */
export class PendingRequests {
  private pending = new Map<string, (msg: ActaMessage) => void>()

  /**
   * CID:pending-002 - resolveIfPending Method
   * Purpose: Resolves pending request if message is a reply
   * Uses: Map operations, message.replyTo property
   * Used by: RuntimeIpcCore WebSocket onmessage handler
   */
  resolveIfPending(msg: ActaMessage): boolean {
    const replyTo = typeof (msg as any).replyTo === 'string' ? String((msg as any).replyTo) : ''
    if (!replyTo.length) return false

    const resolver = this.pending.get(replyTo)
    if (!resolver) return false

    this.pending.delete(replyTo)
    resolver(msg)
    return true
  }

  /**
   * CID:pending-003 - waitForReply Method
   * Purpose: Creates promise that resolves when reply arrives or times out
   * Uses: Promise, setTimeout, Map operations
   * Used by: RuntimeIpcCore.request() for async request handling
   */
  waitForReply(id: string, timeoutMs: number): Promise<ActaMessage> {
    return new Promise<ActaMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('Runtime IPC request timeout'))
      }, timeoutMs)

      this.pending.set(id, reply => {
        clearTimeout(timeout)
        resolve(reply)
      })
    })
  }

  /**
   * CID:pending-004 - clear Method
   * Purpose: Clears all pending requests
   * Uses: Map.clear()
   * Used by: RuntimeIpcCore.disconnect() for cleanup
   */
  clear(): void {
    this.pending.clear()
  }
}
