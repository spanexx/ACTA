import type { ActaMessage, ProfileSwitchPayload, ProfileSwitchRequest, ProfileSummary } from '@acta/ipc'

import type { AgentService } from '../../../agent.service'
import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleProfileSwitch(opts: {
  profileService: ProfileService
  agentService: AgentService
  emitMessage: EmitMessage
  toSummary: (profile: { id: string; name: string }, activeId: string | null) => ProfileSummary
}): (msg: ActaMessage<ProfileSwitchRequest>) => Promise<void> {
  return async (msg: ActaMessage<ProfileSwitchRequest>): Promise<void> => {
    if (!msg.payload || typeof msg.payload.profileId !== 'string') {
      throw new Error('Invalid profile.switch payload (missing profileId)')
    }
    if (opts.agentService.isRunning()) {
      throw new Error('Profile switch blocked while a task is running')
    }

    const profile = await opts.profileService.switch(msg.payload.profileId)
    const activeId = opts.profileService.getActiveProfileId()

    const payload: ProfileSwitchPayload = {
      profile: opts.toSummary(profile, activeId),
    }

    opts.emitMessage('profile.switch', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
