import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class LogsStateService {
  busy = false
  status = ''

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
