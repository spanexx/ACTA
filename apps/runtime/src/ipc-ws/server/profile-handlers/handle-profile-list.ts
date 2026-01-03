import type { ActaMessage, ProfileListPayload, ProfileSummary } from '@acta/ipc'

import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleProfileList(opts: {
  profileService: ProfileService
  emitMessage: EmitMessage
  toSummary: (profile: { id: string; name: string }, activeId: string | null) => ProfileSummary
}): (msg: ActaMessage) => Promise<void> {
  return async (msg: ActaMessage): Promise<void> => {
    const activeId = opts.profileService.getActiveProfileId()
    const profiles = await opts.profileService.list()
    const payload: ProfileListPayload = {
      profiles: profiles.map(p => opts.toSummary(p, activeId)),
    }
    opts.emitMessage('profile.list', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
