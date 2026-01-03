/*
 * Code Map: Permission Coordinator Facade
 * - PermissionCoordinator: Thin wrapper exposing core permission APIs
 *
 * CID Index:
 * CID:permission-coordinator-001 -> PermissionCoordinator class
 * CID:permission-coordinator-002 -> handlePermissionResponse
 * CID:permission-coordinator-003 -> createAgentEventAdapter
 * CID:permission-coordinator-004 -> waitForPermission
 *
 * Quick lookup: rg -n "CID:permission-coordinator-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permission-coordinator.ts
 */

import type { ActaMessage } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

import { PermissionCoordinatorCore, type PermissionCoordinatorOptions } from './permissions/permission-coordinator-core'

// CID:permission-coordinator-001 - PermissionCoordinator
// Purpose: Provide lightweight wrapper around PermissionCoordinatorCore for DI friendliness
// Uses: PermissionCoordinatorCore to delegate all behavior
// Used by: Runtime IPC server and task handlers
export class PermissionCoordinator {
  private core: PermissionCoordinatorCore

  constructor(opts: PermissionCoordinatorOptions) {
    this.core = new PermissionCoordinatorCore(opts)
  }

  // CID:permission-coordinator-002 - handlePermissionResponse
  // Purpose: Forward permission responses to core handler
  // Uses: PermissionCoordinatorCore.handlePermissionResponse
  // Used by: IPC router when receiving permission.response
  async handlePermissionResponse(msg: ActaMessage): Promise<void> {
    await this.core.handlePermissionResponse(msg)
  }

  // CID:permission-coordinator-003 - createAgentEventAdapter
  // Purpose: Expose adapter factory for agent events with pass-through to core
  // Uses: PermissionCoordinatorCore.createAgentEventAdapter
  // Used by: Task handlers when starting agent execution
  createAgentEventAdapter(opts: { correlationId: string; profileId: string; taskId: string }): (type: string, payload: any) => void {
    return this.core.createAgentEventAdapter(opts)
  }

  // CID:permission-coordinator-004 - waitForPermission
  // Purpose: Provide promise-based permission waiting interface
  // Uses: PermissionCoordinatorCore.waitForPermission
  // Used by: Task handlers to pause execution until decision arrives
  waitForPermission(opts: { correlationId: string }): (request: PermissionRequest) => Promise<PermissionDecisionType> {
    return this.core.waitForPermission(opts)
  }
}
