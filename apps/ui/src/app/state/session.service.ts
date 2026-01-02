import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import type { TrustLevel } from '../models/ui.models'

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

  get profileId(): string {
    return this.profileIdSubject.value
  }

  setProfileId(profileId: string): void {
    this.profileIdSubject.next(profileId)
  }

  get trustLevel(): TrustLevel {
    return this.trustLevelSubject.value
  }

  setTrustLevel(trustLevel: TrustLevel): void {
    this.trustLevelSubject.next(trustLevel)
  }

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
