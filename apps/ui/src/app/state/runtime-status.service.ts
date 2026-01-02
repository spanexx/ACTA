import { Injectable, NgZone } from '@angular/core'
import type { Subscription } from 'rxjs'
import { RuntimeIpcService, type RuntimeConnectionState } from '../runtime-ipc.service'

@Injectable({ providedIn: 'root' })
export class RuntimeStatusService {
  runtimeConn: RuntimeConnectionState = { status: 'disconnected' }
  pingStatus = 'not checked'

  private connSub: Subscription | null = null

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

  async refreshPing(): Promise<void> {
    this.pingStatus = await this.safePing()
  }

  disconnect(): void {
    this.connSub?.unsubscribe?.()
    this.connSub = null
  }

  private async safePing(): Promise<string> {
    try {
      if (!window.ActaAPI) return 'ActaAPI not available'
      return await window.ActaAPI.ping()
    } catch {
      return 'ping failed'
    }
  }
}
