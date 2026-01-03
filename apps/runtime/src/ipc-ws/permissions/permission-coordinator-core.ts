/*
 * Code Map: Permission Coordinator Core
 * - PermissionCoordinatorCore: Main class for permission coordination
 * - handlePermissionResponse: Handle permission response messages
 * - createAgentEventAdapter: Create agent event adapter
 * - waitForPermission: Create permission wait handler
 * 
 * CID Index:
 * CID:permission-coordinator-core-001 -> PermissionCoordinatorCore constructor
 * CID:permission-coordinator-core-002 -> handlePermissionResponse
 * CID:permission-coordinator-core-003 -> createAgentEventAdapter
 * CID:permission-coordinator-core-004 -> waitForPermission
 * 
 * Quick lookup: rg -n "CID:permission-coordinator-core-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/permission-coordinator-core.ts
 */

import type { ActaMessage } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

import { createPermissionCoordinatorState, type PermissionCoordinatorState } from './state'
import type { PermissionCoordinatorOptions } from './types'
import { createAgentEventAdapter } from './agent-adapter'
import { handlePermissionResponse } from './response-handler'
import { waitForPermission } from './wait'

// CID:permission-coordinator-core-001 - PermissionCoordinatorCore constructor
// Purpose: Initialize permission coordinator with state and handlers
// Uses: PermissionCoordinatorOptions, state creation
// Used by: Runtime core server for permission management
export class PermissionCoordinatorCore {
  private state: PermissionCoordinatorState

  constructor(opts: PermissionCoordinatorOptions) {
    this.state = createPermissionCoordinatorState(opts)
  }

  // CID:permission-coordinator-core-002 - handlePermissionResponse
  // Purpose: Handle incoming permission response messages from UI
  // Uses: Response handler function, coordinator state
  // Used by: Runtime core server for permission responses
  async handlePermissionResponse(msg: ActaMessage): Promise<void> {
    await handlePermissionResponse(this.state, msg)
  }

  // CID:permission-coordinator-core-003 - createAgentEventAdapter
  // Purpose: Create event adapter for agent-to-IPC communication
  // Uses: Agent event adapter factory, coordinator state
  // Used by: Task handlers for agent event emission
  createAgentEventAdapter(opts: { correlationId: string; profileId: string; taskId: string }): (type: string, payload: any) => void {
    return createAgentEventAdapter(this.state, opts)
  }

  // CID:permission-coordinator-core-004 - waitForPermission
  // Purpose: Create permission wait handler for agent requests
  // Uses: Wait handler factory, coordinator state
  // Used by: Task handlers for permission coordination
  waitForPermission(opts: { correlationId: string }): (request: PermissionRequest) => Promise<PermissionDecisionType> {
    return waitForPermission(this.state, opts)
  }
}

export type { PermissionCoordinatorOptions } from './types'
