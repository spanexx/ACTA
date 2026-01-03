/*
 * Code Map: Demo Permission Request Service
 * - PermissionsService: Handles demo permission requests and resolves them when the renderer responds.
 * - Maintains an in-memory map of pending permission requests with timeouts.
 *
 * CID Index:
 * CID:permissions.service-001 -> PendingPermission type
 * CID:permissions.service-002 -> PermissionsService (state container)
 * CID:permissions.service-003 -> handlePermissionResponse
 * CID:permissions.service-004 -> demoPermissionRequest
 *
 * Lookup: rg -n "CID:permissions.service-" apps/ui/electron/src/main/permissions.service.ts
 */

import { randomUUID } from 'node:crypto'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../ipc-contract'
import type {
  PermissionDecision,
  PermissionRequestEvent,
  PermissionResponsePayload,
} from '../ipc-contract'

// CID:permissions.service-001 - Pending Permission Entry
// Purpose: Tracks a pending permission request and how to resolve it.
// Uses: NodeJS.Timeout, PermissionDecision
// Used by: PermissionsService.pendingPermissions map
type PendingPermission = {
  resolve: (decision: PermissionDecision) => void
  timeout: NodeJS.Timeout
}

// CID:permissions.service-002 - Demo Permission State Container
// Purpose: Stores pending permission requests and bridges between IPC and renderer responses.
// Uses: IPC channels, IpcMainInvokeEvent.sender.send
// Used by: ipc-handlers.ts (permissionResponse + demoPermissionRequest)
export class PermissionsService {
  private pendingPermissions = new Map<string, PendingPermission>()

  // CID:permissions.service-003 - Handle Permission Response
  // Purpose: Resolves a pending permission request when the renderer submits a decision.
  // Uses: pendingPermissions map, clearTimeout
  // Used by: ipc-handlers.ts via IPC_CHANNELS.permissionResponse
  handlePermissionResponse(payload: PermissionResponsePayload): void {
    const pending = this.pendingPermissions.get(payload.requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(payload.decision)
      this.pendingPermissions.delete(payload.requestId)
    }
  }

  // CID:permissions.service-004 - Demo Permission Request
  // Purpose: Emits a demo permission request to the renderer and awaits the user's response (or timeout).
  // Uses: randomUUID(), IPC_CHANNELS.permissionRequest, pendingPermissions map
  // Used by: ipc-handlers.ts via IPC_CHANNELS.demoPermissionRequest
  async demoPermissionRequest(event: IpcMainInvokeEvent): Promise<PermissionDecision> {
    const requestId = randomUUID()

    const payload: PermissionRequestEvent = {
      id: requestId,
      tool: 'file.read',
      scope: '/Reports/Q4.pdf',
      reason: 'Read the file you referenced.',
      risk: 'Reads a local file from disk',
      risks: ['May reveal file contents to the UI/runtime'],
      reversible: true,
      rememberDecision: true,
      trustLevel: 1,
    }

    return await new Promise<PermissionDecision>(resolve => {
      const timeout = setTimeout(() => {
        this.pendingPermissions.delete(requestId)
        resolve('deny')
      }, 30_000)

      this.pendingPermissions.set(requestId, { resolve, timeout })
      event.sender.send(IPC_CHANNELS.permissionRequest, payload)
    })
  }
}
