import type { ActaMessage, ProfileDeletePayload, ProfileDeleteRequest } from '@acta/ipc'

import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleProfileDelete(opts: {
  profileService: ProfileService
  emitMessage: EmitMessage
}): (msg: ActaMessage<ProfileDeleteRequest>) => Promise<void> {
  return async (msg: ActaMessage<ProfileDeleteRequest>): Promise<void> => {
    if (!msg.payload || typeof msg.payload.profileId !== 'string') {
      throw new Error('Invalid profile.delete payload (missing profileId)')
    }

    await opts.profileService.delete(msg.payload.profileId, { deleteFiles: msg.payload.deleteFiles })
    const activeId = opts.profileService.getActiveProfileId()

    const payload: ProfileDeletePayload = {
      deleted: true,
      profileId: msg.payload.profileId,
    }

    opts.emitMessage('profile.delete', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
