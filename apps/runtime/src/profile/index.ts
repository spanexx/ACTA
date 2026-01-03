/*
 * Code Map: Profile Module Public Exports
 * - Re-exports types and constructors that form the public profile module API.
 *
 * CID Index:
 * CID:profile-index-001 -> exported types
 * CID:profile-index-002 -> createProfileServiceState/ProfileServiceState
 * CID:profile-index-003 -> ProfileServiceCore
 *
 * Lookup: rg -n "CID:profile-index-" apps/runtime/src/profile/index.ts
 */

// CID:profile-index-001 - Exported Types
// Purpose: Re-exports profile module type definitions.
// Uses: types.ts
// Used by: External runtime imports
export type { ProfileUpdatePatch, ActiveProfilePointer } from './types'

// CID:profile-index-002 - State Factory + Type
// Purpose: Re-exports profile service state factory and type.
// Uses: state.ts
// Used by: apps/runtime/src/profile.service.ts and other runtime consumers
export { createProfileServiceState, type ProfileServiceState } from './state'

// CID:profile-index-003 - Core Service Class
// Purpose: Re-exports ProfileServiceCore API.
// Uses: profile-service-core.ts
// Used by: apps/runtime/src/profile.service.ts
export { ProfileServiceCore } from './profile-service-core'
