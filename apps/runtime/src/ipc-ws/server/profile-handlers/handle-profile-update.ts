import type { ActaMessage, ProfileDoc, ProfileUpdatePayload, ProfileUpdateRequest } from '@acta/ipc'

import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleProfileUpdate(opts: {
  profileService: ProfileService
  emitMessage: EmitMessage
  toDoc: (profile: any) => ProfileDoc
}): (msg: ActaMessage<ProfileUpdateRequest>) => Promise<void> {
  return async (msg: ActaMessage<ProfileUpdateRequest>): Promise<void> => {
    if (!msg.payload || typeof msg.payload.profileId !== 'string' || !msg.payload.profileId.trim()) {
      throw new Error('Invalid profile.update payload (missing profileId)')
    }

    const updated = await opts.profileService.update(msg.payload.profileId, msg.payload.patch as any)
    const activeId = opts.profileService.getActiveProfileId()

    const payload: ProfileUpdatePayload = {
      profile: opts.toDoc(updated),
    }

    opts.emitMessage('profile.update', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
