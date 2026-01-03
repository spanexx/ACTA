/**
 * Code Map: Permission Request Listener
 * - Provides attachActaApiPermissionListener function for handling ActaAPI permission events
 * 
 * CID Index:
 * CID:listener-001 -> attachActaApiPermissionListener function
 * 
 * Quick lookup: grep -n "CID:listener-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/permission-state/listener.ts
 */

import type { NgZone } from '@angular/core'
import type { PermissionRequestEvent } from '../../models/ui.models'

/**
 * CID:listener-001 - attachActaApiPermissionListener Function
 * Purpose: Attaches listener to ActaAPI for permission requests with NgZone integration
 * Uses: NgZone from Angular core, window.ActaAPI global
 * Used by: PermissionStateService for handling browser-based permission requests
 */
export function attachActaApiPermissionListener(opts: {
  zone: NgZone
  onRequest: (req: PermissionRequestEvent, now: number) => void
  existingUnsubscribe: (() => void) | null
}): (() => void) | null {
  if (!window.ActaAPI) return null
  if (opts.existingUnsubscribe) return opts.existingUnsubscribe

  return window.ActaAPI.onPermissionRequest(req => {
    opts.zone.run(() => {
      opts.onRequest(req, Date.now())
    })
  })
}
