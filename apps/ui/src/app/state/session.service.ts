/*
 * Code Map: Session State
 * - SessionService: Holds cross-cutting session values (demo flag, active profileId, trustLevel).
 * - Uses BehaviorSubjects for reactive consumption in components/services.
 *
 * CID Index:
 * CID:session.service-001 -> SessionService (state container)
 * CID:session.service-002 -> profileId$ / setProfileId
 * CID:session.service-003 -> trustLevel$ / setTrustLevel
 * CID:session.service-004 -> readDemoEnabled
 *
 * Lookup: rg -n "CID:session.service-" apps/ui/src/app/state/session.service.ts
 */

import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import type { TrustLevel } from '../models/ui.models'

// CID:session.service-001 - Session State Container
// Purpose: Stores session-wide values shared across multiple UI features.
// Uses: RxJS BehaviorSubject; browser URL/localStorage
// Used by: ChatStateService, SetupStateService, TrustStateService, ProfilesActionsService, DemoStateService
@Injectable({ providedIn: 'root' })
export class SessionService {
  private demoEnabledValue = this.readDemoEnabled()

  private profileIdSubject = new BehaviorSubject<string>('default')
  readonly profileId$ = this.profileIdSubject.asObservable()

  private trustLevelSubject = new BehaviorSubject<TrustLevel>(1)
  readonly trustLevel$ = this.trustLevelSubject.asObservable()

  get demoEnabled(): boolean {
    return this.demoEnabledValue
  }

  // CID:session.service-002 - Active Profile ID
  // Purpose: Exposes and updates the active profile id for this renderer session.
  // Uses: BehaviorSubject
  // Used by: Most runtime IPC calls that need profile scoping
  get profileId(): string {
    return this.profileIdSubject.value
  }

  setProfileId(profileId: string): void {
    this.profileIdSubject.next(profileId)
  }

  // CID:session.service-003 - Active Trust Level
  // Purpose: Exposes and updates the current trust level.
  // Uses: BehaviorSubject
  // Used by: TrustStateService, SetupStateService
  get trustLevel(): TrustLevel {
    return this.trustLevelSubject.value
  }

  setTrustLevel(trustLevel: TrustLevel): void {
    this.trustLevelSubject.next(trustLevel)
  }

  // CID:session.service-004 - Demo Mode Detection
  // Purpose: Determines whether demo mode is enabled via URL param or localStorage.
  // Uses: globalThis.location, URLSearchParams, globalThis.localStorage
  // Used by: DemoStateService.enabled
  private readDemoEnabled(): boolean {
    try {
      const href = typeof globalThis.location?.href === 'string' ? globalThis.location.href : ''
      if (href.length) {
        const url = new URL(href)
        if (url.searchParams.get('demo') === '1') return true
      }
    } catch {
      // ignore
    }

    try {
      return globalThis.localStorage?.getItem('acta:enableDemos') === '1'
    } catch {
      return false
    }
  }
}
