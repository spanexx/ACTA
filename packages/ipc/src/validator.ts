/*
 * Code Map: IPC Validator (Facade)
 * - Re-exports helper predicates/constants and the envelope/payload validators.
 * - Keeps a stable public surface for @acta/ipc consumers.
 *
 * CID Index:
 * CID:ipc-validator-001 -> helpers re-exports
 * CID:ipc-validator-002 -> isValidActaMessage re-export
 * CID:ipc-validator-003 -> validatePayloadDetailed/validatePayload re-export
 *
 * Quick lookup: rg -n "CID:ipc-validator-" /home/spanexx/Shared/Projects/ACTA/packages/ipc/src/validator.ts
 */

// CID:ipc-validator-001 - helpers re-exports
export {
  isPlainObject,
  isNonEmptyString,
  isStringArray,
  isValidTrustLevel,
  MAX_TASK_INPUT_CHARS,
  MAX_TASK_ATTACHMENTS,
  MAX_TASK_ATTACHMENT_PATH_CHARS,
} from './validator/helpers'

// CID:ipc-validator-002 - envelope validator re-export
export { isValidActaMessage } from './validator/envelope'

// CID:ipc-validator-003 - payload validators re-export
export { validatePayloadDetailed, validatePayload, type PayloadValidationResult } from './validator/payload'
