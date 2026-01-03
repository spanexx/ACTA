/**
 * Code Map: Reconnection Management
 * - Provides ReconnectController class for WebSocket reconnection logic
 * 
 * CID Index:
 * CID:reconnect-001 -> ReconnectController class
 * CID:reconnect-002 -> reset method
 * CID:reconnect-003 -> clear method
 * CID:reconnect-004 -> schedule method
 * 
 * Quick lookup: grep -n "CID:reconnect-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/runtime-ipc/reconnect.ts
 */

/**
 * CID:reconnect-001 - ReconnectController Class
 * Purpose: Manages WebSocket reconnection with exponential backoff
 * Uses: setTimeout, exponential backoff algorithm
 * Used by: RuntimeIpcCore for connection resilience
 */
export class ReconnectController {
  private timer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0

  /**
   * CID:reconnect-002 - reset Method
   * Purpose: Resets reconnection attempt counter
   * Uses: Simple assignment
   * Used by: RuntimeIpcCore.connect() on successful connection
   */
  reset(): void {
    this.attempt = 0
  }

  /**
   * CID:reconnect-003 - clear Method
   * Purpose: Cancels pending reconnection timer
   * Uses: clearTimeout
   * Used by: RuntimeIpcCore.connect() and disconnect()
   */
  clear(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
  }

  /**
   * CID:reconnect-004 - schedule Method
   * Purpose: Schedules reconnection attempt with exponential backoff
   * Uses: setTimeout, exponential backoff calculation
   * Used by: RuntimeIpcCore.scheduleReconnect()
   */
  schedule(opts: { shouldRun: () => boolean; connect: () => void }): void {
    this.clear()

    const attempt = Math.min(this.attempt, 6)
    const delayMs = Math.min(30_000, 500 * 2 ** attempt)
    this.attempt += 1

    this.timer = setTimeout(() => {
      if (!opts.shouldRun()) return
      opts.connect()
    }, delayMs)
  }
}
