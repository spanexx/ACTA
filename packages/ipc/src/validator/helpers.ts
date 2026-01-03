/*
 * Code Map: IPC Validator Helpers
 * - Shared predicate helpers and constants used by envelope + payload validators.
 *
 * CID Index:
 * CID:ipc-validator-helpers-001 -> isPlainObject
 * CID:ipc-validator-helpers-002 -> isNonEmptyString
 * CID:ipc-validator-helpers-003 -> isStringArray
 * CID:ipc-validator-helpers-004 -> isValidTrustLevel
 * CID:ipc-validator-helpers-005 -> MAX_* constants
 *
 * Quick lookup: rg -n "CID:ipc-validator-helpers-" packages/ipc/src/validator/helpers.ts
 */

// CID:ipc-validator-helpers-001 - isPlainObject
// Purpose: Guard that a value is a non-null object and not an array.
// Uses: typeof/null checks.
// Used by: Payload validators to validate structured payload shapes.
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// CID:ipc-validator-helpers-002 - isNonEmptyString
// Purpose: Guard that a value is a non-empty string after trimming.
// Uses: typeof/string trim.
// Used by: Payload validators to validate required string fields.
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

// CID:ipc-validator-helpers-003 - isStringArray
// Purpose: Guard that a value is an array of strings.
// Uses: Array.isArray and element typeof checks.
// Used by: task.request context.files validation.
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

// CID:ipc-validator-helpers-004 - isValidTrustLevel
// Purpose: Validate trust level literal values.
// Uses: strict equality checks.
// Used by: task.request trustLevel validation.
export function isValidTrustLevel(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high'
}

// CID:ipc-validator-helpers-005 - MAX_* constants
// Purpose: Centralize validator input bounds.
// Uses: numeric constants.
// Used by: task.request payload validation.
export const MAX_TASK_INPUT_CHARS = 20_000
export const MAX_TASK_ATTACHMENTS = 50
export const MAX_TASK_ATTACHMENT_PATH_CHARS = 500
