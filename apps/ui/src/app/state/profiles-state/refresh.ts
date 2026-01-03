/*
 * Code Map: Profile List Refresh
 * - refreshProfiles: Refreshes profile list from runtime and updates session state
 * 
 * CID Index:
 * CID:refresh-001 -> refreshProfiles
 * 
 * Lookup: rg -n "CID:refresh-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/profiles-state/refresh.ts
 */

import type { RuntimeIpcService } from '../../runtime-ipc.service'
import type { SessionService } from '../session.service'
import type { ProfileInfo } from '../../models/ui.models'

// CID:refresh-001 - Profile List Refresh & Session Update
// Purpose: Fetches current profile list from runtime and updates session state with active profile
// Uses: RuntimeIpcService.profileList(), SessionService.setProfileId()
// Used by: profiles-actions.service.ts (refreshProfiles action)
export async function refreshProfiles(opts: {
  runtimeIpc: RuntimeIpcService
  session: SessionService
  current: { busy: boolean; profileId: string; profiles: ProfileInfo[]; selection: string }
}): Promise<{
  ok: true
  nextProfiles: ProfileInfo[]
  nextProfileId: string
  nextSelection: string
} | null> {
  if (opts.current.busy) return null

  try {
    const list = await opts.runtimeIpc.profileList()
    const active = list.profiles.find(p => p.active) ?? null

    const nextProfiles: ProfileInfo[] = list.profiles.map(p => ({
      id: p.id,
      name: p.name,
      isActive: p.active,
      dataPath: '',
    }))

    const activeId = active?.id ?? (nextProfiles[0]?.id ?? 'default')
    opts.session.setProfileId(activeId)

    return {
      ok: true,
      nextProfiles,
      nextProfileId: activeId,
      nextSelection: activeId,
    }
  } catch {
    return null
  }
}
