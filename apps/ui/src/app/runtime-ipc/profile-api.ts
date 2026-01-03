/**
 * Code Map: Profile API Factory
 * - Provides createProfileApi function for generating profile RPC helpers
 * 
 * CID Index:
 * CID:profile-api-001 -> createProfileApi function
 * 
 * Quick lookup: grep -n "CID:profile-api-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/runtime-ipc/profile-api.ts
 */

import type {
  ActaMessage,
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
} from '@acta/ipc'

/**
 * CID:profile-api-001 - createProfileApi Function
 * Purpose: Factory function that creates profile RPC helper functions
 * Uses: Profile payload/request types from @acta/ipc
 * Used by: RuntimeIpcCore for profile API convenience methods
 */
export function createProfileApi(request: (type: any, payload: any) => Promise<ActaMessage>) {
  return {
    profileActive: async (): Promise<ProfileActivePayload> => {
      const reply = await request('profile.active', {})
      return reply.payload as ProfileActivePayload
    },
    profileList: async (): Promise<ProfileListPayload> => {
      const reply = await request('profile.list', {})
      return reply.payload as ProfileListPayload
    },
    profileCreate: async (payload: ProfileCreateRequest): Promise<ProfileCreatePayload> => {
      const reply = await request('profile.create', payload)
      return reply.payload as ProfileCreatePayload
    },
    profileDelete: async (payload: ProfileDeleteRequest): Promise<ProfileDeletePayload> => {
      const reply = await request('profile.delete', payload)
      return reply.payload as ProfileDeletePayload
    },
    profileSwitch: async (payload: ProfileSwitchRequest): Promise<ProfileSwitchPayload> => {
      const reply = await request('profile.switch', payload)
      return reply.payload as ProfileSwitchPayload
    },
    profileGet: async (payload: ProfileGetRequest): Promise<ProfileGetPayload> => {
      const reply = await request('profile.get', payload)
      return reply.payload as ProfileGetPayload
    },
    profileUpdate: async (payload: ProfileUpdateRequest): Promise<ProfileUpdatePayload> => {
      const reply = await request('profile.update', payload)
      return reply.payload as ProfileUpdatePayload
    },
  }
}
