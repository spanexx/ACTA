/*
 * Code Map: Profile Data Mappers
 * - toDoc: Convert profile data to full document format
 * - toSummary: Convert profile data to summary format
 * 
 * CID Index:
 * CID:profile-mappers-001 -> toDoc
 * CID:profile-mappers-002 -> toSummary
 * 
 * Quick lookup: rg -n "CID:profile-mappers-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/server/profile-mappers.ts
 */

import type { ProfileDoc, ProfileSummary } from '@acta/ipc'

// CID:profile-mappers-001 - toDoc
// Purpose: Convert raw profile data to structured ProfileDoc with type safety
// Uses: ProfileDoc type from @acta/ipc
// Used by: Profile handlers for get/update operations
export function toDoc(profile: any): ProfileDoc {
  return {
    id: profile.id,
    name: profile.name,
    setupComplete: Boolean(profile.setupComplete),
    trust: {
      defaultTrustLevel: Number(profile.trust?.defaultTrustLevel ?? 2),
      tools: profile.trust?.tools,
      domains: profile.trust?.domains,
    },
    llm: {
      mode: profile.llm?.mode === 'cloud' ? 'cloud' : 'local',
      adapterId: String(profile.llm?.adapterId ?? 'ollama'),
      model: String(profile.llm?.model ?? 'llama3:8b'),
      baseUrl: typeof profile.llm?.baseUrl === 'string' ? profile.llm.baseUrl : undefined,
      endpoint: typeof profile.llm?.endpoint === 'string' ? profile.llm.endpoint : undefined,
      headers:
        profile.llm?.headers && typeof profile.llm.headers === 'object' && !Array.isArray(profile.llm.headers)
          ? (profile.llm.headers as Record<string, string>)
          : undefined,
      cloudWarnBeforeSending:
        typeof profile.llm?.cloudWarnBeforeSending === 'boolean' ? profile.llm.cloudWarnBeforeSending : undefined,
      defaults:
        profile.llm?.defaults && typeof profile.llm.defaults === 'object'
          ? {
              temperature:
                typeof (profile.llm.defaults as any).temperature === 'number'
                  ? (profile.llm.defaults as any).temperature
                  : undefined,
              maxTokens:
                typeof (profile.llm.defaults as any).maxTokens === 'number'
                  ? (profile.llm.defaults as any).maxTokens
                  : undefined,
            }
          : undefined,
    },
  }
}

// CID:profile-mappers-002 - toSummary
// Purpose: Convert profile data to summary format with active status
// Uses: ProfileSummary type from @acta/ipc
// Used by: Profile handlers for list/create/switch operations
export function toSummary(profile: { id: string; name: string }, activeId: string | null): ProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    active: profile.id === activeId,
  }
}
