/*
 * Code Map: Profile Message Handlers
 * - createProfileHandlers: Factory for profile operation handlers
 * - handleProfileList: List all profiles with active status
 * - handleProfileActive: Get currently active profile
 * - handleProfileCreate: Create new profile
 * - handleProfileDelete: Delete existing profile
 * - handleProfileSwitch: Switch active profile
 * - handleProfileGet: Get detailed profile document
 * - handleProfileUpdate: Update profile configuration
 * 
 * CID Index:
 * CID:profile-handlers-001 -> createProfileHandlers
 * CID:profile-handlers-002 -> handleProfileList
 * CID:profile-handlers-003 -> handleProfileActive
 * CID:profile-handlers-004 -> handleProfileCreate
 * CID:profile-handlers-005 -> handleProfileDelete
 * CID:profile-handlers-006 -> handleProfileSwitch
 * CID:profile-handlers-007 -> handleProfileGet
 * CID:profile-handlers-008 -> handleProfileUpdate
 * 
 * Quick lookup: rg -n "CID:profile-handlers-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/server/profile-handlers.ts
 */

import type {
  ActaMessage,
  ActaMessageType,
  ProfileActivePayload,
  ProfileCreatePayload,
  ProfileCreateRequest,
  ProfileDeletePayload,
  ProfileDeleteRequest,
  ProfileGetPayload,
  ProfileGetRequest,
  ProfileListPayload,
  ProfileSwitchPayload,
  ProfileSwitchRequest,
  ProfileUpdatePayload,
  ProfileUpdateRequest,
  ProfileDoc,
  ProfileSummary,
} from '@acta/ipc'

import type { AgentService } from '../../agent.service'
import type { ProfileService } from '../../profile.service'

export type EmitMessage = <T>(
  type: ActaMessageType,
  payload: T,
  opts: { correlationId?: string; profileId?: string; replyTo?: string; source?: ActaMessage['source'] },
) => void

export type ProfileHandlers = {
  handleProfileList: (msg: ActaMessage) => Promise<void>
  handleProfileActive: (msg: ActaMessage) => Promise<void>
  handleProfileCreate: (msg: ActaMessage<ProfileCreateRequest>) => Promise<void>
  handleProfileDelete: (msg: ActaMessage<ProfileDeleteRequest>) => Promise<void>
  handleProfileSwitch: (msg: ActaMessage<ProfileSwitchRequest>) => Promise<void>
  handleProfileGet: (msg: ActaMessage<ProfileGetRequest>) => Promise<void>
  handleProfileUpdate: (msg: ActaMessage<ProfileUpdateRequest>) => Promise<void>
}

// CID:profile-handlers-001 - createProfileHandlers
// Purpose: Factory function creating all profile operation handlers
// Uses: ProfileService, AgentService, emitMessage callback, mapper functions
// Used by: Runtime core server during initialization
export function createProfileHandlers(opts: {
  profileService: ProfileService
  agentService: AgentService
  emitMessage: EmitMessage
  toDoc: (profile: any) => ProfileDoc
  toSummary: (profile: { id: string; name: string }, activeId: string | null) => ProfileSummary
}): ProfileHandlers {
  return {
    // CID:profile-handlers-002 - handleProfileList
    // Purpose: List all profiles with active status highlighted
    // Uses: ProfileService list/getActiveProfileId, toSummary mapper
    // Used by: Router for profile.list message type
    handleProfileList: async (msg: ActaMessage): Promise<void> => {
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
    },

    // CID:profile-handlers-003 - handleProfileActive
    // Purpose: Return currently active profile or null if none
    // Uses: ProfileService getActiveProfileId/getActiveProfile, toSummary mapper
    // Used by: Router for profile.active message type
    handleProfileActive: async (msg: ActaMessage): Promise<void> => {
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
    },

    // CID:profile-handlers-004 - handleProfileCreate
    // Purpose: Create new profile with validation and return summary
    // Uses: ProfileService create, toSummary mapper, input validation
    // Used by: Router for profile.create message type
    handleProfileCreate: async (msg: ActaMessage<ProfileCreateRequest>): Promise<void> => {
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
    },

    // CID:profile-handlers-005 - handleProfileDelete
    // Purpose: Delete profile with optional file deletion
    // Uses: ProfileService delete, input validation
    // Used by: Router for profile.delete message type
    handleProfileDelete: async (msg: ActaMessage<ProfileDeleteRequest>): Promise<void> => {
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
    },

    // CID:profile-handlers-006 - handleProfileSwitch
    // Purpose: Switch active profile with task execution safety check
    // Uses: ProfileService switch, AgentService isRunning check, toSummary mapper
    // Used by: Router for profile.switch message type
    handleProfileSwitch: async (msg: ActaMessage<ProfileSwitchRequest>): Promise<void> => {
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
    },

    // CID:profile-handlers-007 - handleProfileGet
    // Purpose: Get detailed profile document with full configuration
    // Uses: ProfileService getProfile, toDoc mapper
    // Used by: Router for profile.get message type
    handleProfileGet: async (msg: ActaMessage<ProfileGetRequest>): Promise<void> => {
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
    },

    // CID:profile-handlers-008 - handleProfileUpdate
    // Purpose: Update profile configuration with validation
    // Uses: ProfileService update, toDoc mapper, input validation
    // Used by: Router for profile.update message type
    handleProfileUpdate: async (msg: ActaMessage<ProfileUpdateRequest>): Promise<void> => {
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
    },
  }
}
