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
  LLMHealthCheckPayload,
  LLMHealthCheckRequest,
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

import { handleLLMHealthCheck } from './profile-handlers/handle-llm-health-check'
import { handleProfileActive } from './profile-handlers/handle-profile-active'
import { handleProfileCreate } from './profile-handlers/handle-profile-create'
import { handleProfileDelete } from './profile-handlers/handle-profile-delete'
import { handleProfileGet } from './profile-handlers/handle-profile-get'
import { handleProfileList } from './profile-handlers/handle-profile-list'
import { handleProfileSwitch } from './profile-handlers/handle-profile-switch'
import { handleProfileUpdate } from './profile-handlers/handle-profile-update'

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
  handleLLMHealthCheck: (msg: ActaMessage<LLMHealthCheckRequest>) => Promise<void>
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
    handleProfileList: handleProfileList({
      profileService: opts.profileService,
      emitMessage: opts.emitMessage,
      toSummary: opts.toSummary,
    }),
    handleProfileActive: handleProfileActive({
      profileService: opts.profileService,
      emitMessage: opts.emitMessage,
      toSummary: opts.toSummary,
    }),
    handleProfileCreate: handleProfileCreate({
      profileService: opts.profileService,
      emitMessage: opts.emitMessage,
      toSummary: opts.toSummary,
    }),
    handleProfileDelete: handleProfileDelete({
      profileService: opts.profileService,
      emitMessage: opts.emitMessage,
    }),
    handleProfileSwitch: handleProfileSwitch({
      profileService: opts.profileService,
      agentService: opts.agentService,
      emitMessage: opts.emitMessage,
      toSummary: opts.toSummary,
    }),
    handleProfileGet: handleProfileGet({
      profileService: opts.profileService,
      emitMessage: opts.emitMessage,
      toDoc: opts.toDoc,
    }),
    handleProfileUpdate: handleProfileUpdate({
      profileService: opts.profileService,
      emitMessage: opts.emitMessage,
      toDoc: opts.toDoc,
    }),
    handleLLMHealthCheck: handleLLMHealthCheck({
      profileService: opts.profileService,
      emitMessage: opts.emitMessage,
    }),
  }
}
