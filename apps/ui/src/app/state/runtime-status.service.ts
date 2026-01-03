/*
 * Code Map: Runtime Status
 * - RuntimeStatusService: Tracks runtime connection state + provides a safe ping status string.
 * - Constructor: subscribes to RuntimeIpcService.connection$ and refreshes ping once.
 * - refreshPing(): updates pingStatus via safePing().
 * - disconnect(): unsubscribes from connection updates.
 *
 * CID Index:
 * CID:runtime-status.service-001 -> RuntimeStatusService (status container)
 * CID:runtime-status.service-002 -> constructor subscription
 * CID:runtime-status.service-003 -> refreshPing
 * CID:runtime-status.service-004 -> disconnect
 * CID:runtime-status.service-005 -> safePing
 *
 * Lookup: rg -n "CID:runtime-status.service-" apps/ui/src/app/state/runtime-status.service.ts
 */

import { Injectable, NgZone } from '@angular/core'
import type { Subscription } from 'rxjs'
import { RuntimeIpcService, type RuntimeConnectionState } from '../runtime-ipc.service'

// CID:runtime-status.service-001 - Runtime Status Container
// Purpose: Keeps renderer-side view of runtime connection state and ping availability.
// Uses: RuntimeIpcService.connection$, window.ActaAPI.ping(), NgZone
// Used by: AppShellService init; shell UI (topbar/status)
@Injectable({ providedIn: 'root' })
export class RuntimeStatusService {
  runtimeConn: RuntimeConnectionState = { status: 'disconnected' }
  pingStatus = 'not checked'

  private connSub: Subscription | null = null

  // CID:runtime-status.service-002 - Connection Subscription
  // Purpose: Subscribes to runtime connection state and updates it inside NgZone.
  // Uses: RuntimeIpcService.connection$, NgZone.run()
  // Used by: RuntimeStatusService instantiation
  constructor(
    private zone: NgZone,
    private runtimeIpc: RuntimeIpcService,
  ) {
    this.connSub = this.runtimeIpc.connection$.subscribe((state: RuntimeConnectionState) => {
      this.zone.run(() => {
        this.runtimeConn = state
      })
    })

    void this.refreshPing()
  }

  // CID:runtime-status.service-003 - Refresh Ping
  // Purpose: Updates pingStatus with a best-effort ping result.
  // Uses: safePing()
  // Used by: AppShellService init; RuntimeStatusService constructor
  async refreshPing(): Promise<void> {
    this.pingStatus = await this.safePing()
  }

  // CID:runtime-status.service-004 - Disconnect
  // Purpose: Unsubscribes from connection updates.
  // Uses: Subscription.unsubscribe()
  // Used by: App shutdown / teardown flows
  disconnect(): void {
    this.connSub?.unsubscribe?.()
    this.connSub = null
  }

  // CID:runtime-status.service-005 - Safe Ping
  // Purpose: Pings the preload API if available, returning a human-readable status.
  // Uses: window.ActaAPI.ping()
  // Used by: refreshPing()
  private async safePing(): Promise<string> {
    try {
      if (!window.ActaAPI) return 'ActaAPI not available'
      return await window.ActaAPI.ping()
    } catch {
      return 'ping failed'
    }
  }
}
