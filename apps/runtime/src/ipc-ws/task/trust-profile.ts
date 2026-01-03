/*
 * Code Map: Trust Profile Construction
 * - buildTrustProfile: Create TrustProfile view from Profile doc + runtime task metadata.
 *
 * CID Index:
 * CID:trust-profile-001 -> buildTrustProfile
 *
 * Quick lookup: rg -n "CID:trust-profile-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/trust-profile.ts
 */

import type { TrustProfile } from '@acta/trust'
import type { RuntimeTask } from '@acta/ipc'

import type { Profile } from '@acta/profiles'

// CID:trust-profile-001 - buildTrustProfile
// Purpose: Normalize the persisted profile trust settings into the runtime TrustProfile shape.
// Uses: Profile.trust defaults; task.profileId for identity.
// Used by: runTaskRequest orchestration when constructing trust evaluators and orchestrators.
export function buildTrustProfile(task: RuntimeTask, profileDoc: Profile): TrustProfile {
  return {
    profileId: task.profileId,
    defaultTrustLevel: profileDoc.trust?.defaultTrustLevel ?? 2,
    tools: profileDoc.trust?.tools,
    domains: profileDoc.trust?.domains,
  }
}
