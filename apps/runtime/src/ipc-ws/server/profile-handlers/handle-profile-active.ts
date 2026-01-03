import type { ActaMessage, ProfileActivePayload, ProfileSummary } from '@acta/ipc'

import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleProfileActive(opts: {
  profileService: ProfileService
  emitMessage: EmitMessage
  toSummary: (profile: { id: string; name: string }, activeId: string | null) => ProfileSummary
}): (msg: ActaMessage) => Promise<void> {
  return async (msg: ActaMessage): Promise<void> => {
    const activeId = opts.profileService.getActiveProfileId()
    const active = await opts.profileService.getActiveProfile()
    const payload: ProfileActivePayload = {
      profile: active ? opts.toSummary(active, activeId) : null,
    }
    opts.emitMessage('profile.active', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
