import type { ProfileServiceState } from './state'
import { resolveProfileScopedDir } from './paths'

/**
 * Code Map: Active Directory Management
 * - CID:active-dirs-001 → Directory refresh function
 * 
 * Lookup: rg -n "CID:active-dirs-" apps/runtime/src/profile/active-dirs.ts
 */

// CID:active-dirs-001 - Directory refresh function
// Purpose: Update active logs/memory directories based on current profile
// Uses: ProfileServiceState, resolveProfileScopedDir helper
// Used by: ProfileServiceCore during profile initialization
export async function refreshActiveDirs(state: ProfileServiceState): Promise<void> {
  const id = state.activeProfileId
  if (!id) {
    state.activeLogsDir = null
    state.activeMemoryDir = null
    return
  }

  try {
    const profile = await state.store.read(id)
    state.activeLogsDir = resolveProfileScopedDir(state.profileRoot, id, profile.paths.logs)
    state.activeMemoryDir = resolveProfileScopedDir(state.profileRoot, id, profile.paths.memory)
  } catch {
    state.activeLogsDir = resolveProfileScopedDir(state.profileRoot, id, 'logs')
    state.activeMemoryDir = resolveProfileScopedDir(state.profileRoot, id, 'memory')
  }
}
