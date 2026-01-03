/*
 * Code Map: Profile Switching Logic
 * - shouldConfirmSwitch: Determines if profile switch needs confirmation due to active tools
 * - switchToProfile: Performs profile switch and updates dependent state services
 * 
 * CID Index:
 * CID:switching-001 -> shouldConfirmSwitch
 * CID:switching-002 -> switchToProfile
 * 
 * Lookup: rg -n "CID:switching-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/profiles-state/switching.ts
 */

import type { RuntimeIpcService } from '../../runtime-ipc.service'
import type { SessionService } from '../session.service'
import type { ToolOutputsStateService } from '../tool-outputs-state.service'
import type { TrustStateService } from '../trust-state.service'
import type { SetupStateService } from '../setup-state.service'
import type { ChatStateService } from '../chat-state.service'

// CID:switching-001 - Switch Confirmation Check
// Purpose: Determines if profile switch should be confirmed based on tool activity
// Uses: ToolOutputsStateService.isToolRunActive()
// Used by: profiles-actions.service.ts (shouldConfirmSwitch check)
export function shouldConfirmSwitch(opts: { busy: boolean; desired: string; currentProfileId: string; toolOutputs: ToolOutputsStateService }): boolean {
  if (opts.busy) return false
  if (!opts.desired.length) return false
  if (opts.desired === opts.currentProfileId) return false
  return opts.toolOutputs.isToolRunActive()
}

// CID:switching-002 - Profile Switch Execution
// Purpose: Switches to specified profile and updates all dependent state services
// Uses: RuntimeIpcService.profileSwitch(), SessionService.setProfileId(), TrustStateService.loadTrustLevel(), SetupStateService.loadConfigAndMaybeOpenWizard(), ChatStateService.addSystemMessage()
// Used by: profiles-actions.service.ts (switchToProfile action)
export async function switchToProfile(opts: {
  runtimeIpc: RuntimeIpcService
  session: SessionService
  trust: TrustStateService
  setup: SetupStateService
  chat: ChatStateService
  profileId: string
}): Promise<{ ok: true; profileId: string } | null> {
  try {
    const res = await opts.runtimeIpc.profileSwitch({ profileId: opts.profileId })
    const id = res.profile.id
    opts.session.setProfileId(id)

    await opts.trust.loadTrustLevel()
    await opts.setup.loadConfigAndMaybeOpenWizard()

    opts.chat.addSystemMessage(`Switched to profile ${id}.`, Date.now())

    return { ok: true, profileId: id }
  } catch {
    return null
  }
}
