/*
 * Code Map: Permission Coordinator State
 * - PermissionCoordinatorState: State interface for permission coordination
 * - createPermissionCoordinatorState: Factory for creating initial state
 * 
 * CID Index:
 * CID:state-001 -> PermissionCoordinatorState type
 * CID:state-002 -> createPermissionCoordinatorState
 * 
 * Quick lookup: rg -n "CID:state-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/permissions/state.ts
 */

import type { PermissionCoordinatorOptions, PendingPermission, PendingPermissionContext } from './types'

// CID:state-001 - PermissionCoordinatorState type
// Purpose: State interface for managing permission requests and context
// Uses: PermissionCoordinatorOptions, PendingPermission, PendingPermissionContext
// Used by: Permission coordinator core and all permission handlers
export type PermissionCoordinatorState = {
  opts: PermissionCoordinatorOptions
  pendingPermissionByMsgId: Map<string, PendingPermission>
  permissionMsgIdByRequestKey: Map<string, string>
  pendingContextByMsgId: Map<string, PendingPermissionContext>
}

// CID:state-002 - createPermissionCoordinatorState
// Purpose: Factory function creating initialized permission coordinator state
// Uses: PermissionCoordinatorOptions type
// Used by: PermissionCoordinatorCore constructor
export function createPermissionCoordinatorState(opts: PermissionCoordinatorOptions): PermissionCoordinatorState {
  return {
    opts,
    pendingPermissionByMsgId: new Map<string, PendingPermission>(),
    permissionMsgIdByRequestKey: new Map<string, string>(),
    pendingContextByMsgId: new Map<string, PendingPermissionContext>(),
  }
}
