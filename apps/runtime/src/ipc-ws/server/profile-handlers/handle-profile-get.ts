import type { ActaMessage, ProfileDoc, ProfileGetPayload, ProfileGetRequest } from '@acta/ipc'

import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleProfileGet(opts: {
  profileService: ProfileService
  emitMessage: EmitMessage
  toDoc: (profile: any) => ProfileDoc
}): (msg: ActaMessage<ProfileGetRequest>) => Promise<void> {
  return async (msg: ActaMessage<ProfileGetRequest>): Promise<void> => {
    const profile = await opts.profileService.getProfile(msg.payload?.profileId)
    const activeId = opts.profileService.getActiveProfileId()

    const payload: ProfileGetPayload = {
      profile: opts.toDoc(profile),
    }

    opts.emitMessage('profile.get', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
