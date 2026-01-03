/*
 * Code Map: Profile Creation & Deletion
 * - createProfile: Creates new profile via runtime IPC
 * - deleteProfile: Deletes profile and refreshes dependent state
 * 
 * CID Index:
 * CID:create-delete-001 -> createProfile
 * CID:create-delete-002 -> deleteProfile
 * 
 * Lookup: rg -n "CID:create-delete-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/profiles-state/create-delete.ts
 */

import type { RuntimeIpcService } from '../../runtime-ipc.service'
import type { TrustStateService } from '../trust-state.service'
import type { SetupStateService } from '../setup-state.service'

// CID:create-delete-001 - Profile Creation
// Purpose: Creates a new profile with the given name via runtime IPC
// Uses: RuntimeIpcService.profileCreate()
// Used by: profiles-actions.service.ts (createProfile action)
export async function createProfile(opts: {
  runtimeIpc: RuntimeIpcService
  name: string
}): Promise<boolean> {
  const name = opts.name.trim()
  if (!name.length) return false

  try {
    await opts.runtimeIpc.profileCreate({ name })
    return true
  } catch {
    return false
  }
}

// CID:create-delete-002 - Profile Deletion & State Refresh
// Purpose: Deletes profile and refreshes trust/setup state after deletion
// Uses: RuntimeIpcService.profileDelete(), TrustStateService.loadTrustLevel(), SetupStateService.loadConfigAndMaybeOpenWizard()
// Used by: profiles-actions.service.ts (deleteProfile action)
export async function deleteProfile(opts: {
  runtimeIpc: RuntimeIpcService
  trust: TrustStateService
  setup: SetupStateService
  profileId: string
  deleteFiles: boolean
}): Promise<boolean> {
  if (!opts.profileId.length) return false

  try {
    await opts.runtimeIpc.profileDelete({ profileId: opts.profileId, deleteFiles: opts.deleteFiles })
    await opts.trust.loadTrustLevel()
    await opts.setup.loadConfigAndMaybeOpenWizard()
    return true
  } catch {
    return false
  }
}
