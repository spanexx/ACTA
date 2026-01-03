import type { ActaMessage, ProfileCreatePayload, ProfileCreateRequest, ProfileSummary } from '@acta/ipc'

import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleProfileCreate(opts: {
  profileService: ProfileService
  emitMessage: EmitMessage
  toSummary: (profile: { id: string; name: string }, activeId: string | null) => ProfileSummary
}): (msg: ActaMessage<ProfileCreateRequest>) => Promise<void> {
  return async (msg: ActaMessage<ProfileCreateRequest>): Promise<void> => {
    if (!msg.payload || typeof msg.payload.name !== 'string' || !msg.payload.name.trim()) {
      throw new Error('Invalid profile.create payload (missing name)')
    }

    const created = await opts.profileService.create({
      name: msg.payload.name,
      profileId: msg.payload.profileId,
    })
    const activeId = opts.profileService.getActiveProfileId()
    const payload: ProfileCreatePayload = {
      profile: opts.toSummary(created, activeId),
    }

    opts.emitMessage('profile.create', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
