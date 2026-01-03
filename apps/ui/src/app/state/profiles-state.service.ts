/*
 * Code Map: Profiles UI State
 * - ProfilesStateService: Holds UI state for profiles (list, active selection, modal flags).
 * - trackByProfileId(): trackBy helper for ngFor rendering.
 *
 * CID Index:
 * CID:profiles-state.service-001 -> ProfilesStateService (state container)
 * CID:profiles-state.service-002 -> trackByProfileId
 *
 * Lookup: rg -n "CID:profiles-state.service-" apps/ui/src/app/state/profiles-state.service.ts
 */

import { Injectable } from '@angular/core'
import type { ProfileInfo } from '../models/ui.models'

// CID:profiles-state.service-001 - Profiles State Container
// Purpose: Stores current profile list/selection plus modal flags used by profiles UI.
// Uses: ProfileInfo model
// Used by: ProfilesActionsService; shell profile components/modals
@Injectable({ providedIn: 'root' })
export class ProfilesStateService {
  profileId = 'default'
  profiles: ProfileInfo[] = []
  selection = 'default'
  busy = false

  manageOpen = false
  newProfileName = ''

  deleteOpen = false
  deleteProfileId: string | null = null
  deleteProfileFiles = false

  switchConfirmOpen = false
  pendingProfileId: string | null = null

  // CID:profiles-state.service-002 - Angular trackBy
  // Purpose: Stabilizes list rendering for profiles.
  // Uses: ProfileInfo.id
  // Used by: Profiles list UI (ngFor trackBy)
  trackByProfileId(_index: number, profile: ProfileInfo): string {
    return profile.id
  }
}
