import { randomUUID } from 'node:crypto'
import type { IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../ipc-contract'
import type {
  PermissionDecision,
  PermissionRequestEvent,
  PermissionResponsePayload,
} from '../ipc-contract'

type PendingPermission = {
  resolve: (decision: PermissionDecision) => void
  timeout: NodeJS.Timeout
}

export class PermissionsService {
  private pendingPermissions = new Map<string, PendingPermission>()

  handlePermissionResponse(payload: PermissionResponsePayload): void {
    const pending = this.pendingPermissions.get(payload.requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(payload.decision)
      this.pendingPermissions.delete(payload.requestId)
    }
  }

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
