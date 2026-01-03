/*
 * Code Map: Logs UI State
 * - LogsStateService: Opens the per-profile logs folder via preload API and reports status.
 *
 * CID Index:
 * CID:logs-state.service-001 -> LogsStateService (state + action)
 * CID:logs-state.service-002 -> openLogsFolder
 *
 * Lookup: rg -n "CID:logs-state.service-" apps/ui/src/app/state/logs-state.service.ts
 */

import { Injectable } from '@angular/core'

// CID:logs-state.service-001 - Logs State Container
// Purpose: Tracks logs action state (busy/status) and provides a single action to open the logs folder.
// Uses: window.ActaAPI (Electron preload API)
// Used by: Shell UI components (e.g. app-shell / topbar)
@Injectable({ providedIn: 'root' })
export class LogsStateService {
  busy = false
  status = ''

  // CID:logs-state.service-002 - Open Logs Folder
  // Purpose: Requests the host (Electron preload API) to open the logs directory and updates status.
  // Uses: window.ActaAPI.openLogsFolder()
  // Used by: Shell UI actions (e.g. topbar / settings)
  async openLogsFolder(): Promise<void> {
    if (this.busy) return
    this.busy = true
    this.status = 'Opening logs…'

    try {
      if (!window.ActaAPI) {
        this.status = 'Logs: ActaAPI not available'
        return
      }

      const res = await window.ActaAPI.openLogsFolder()
      if (res.ok) {
        this.status = `Logs: opened (${res.path})`
      } else {
        this.status = `Logs: failed (${res.error ?? 'unknown error'})`
      }
    } catch {
      this.status = 'Logs: failed (request error)'
    } finally {
      this.busy = false
    }
  }
}
