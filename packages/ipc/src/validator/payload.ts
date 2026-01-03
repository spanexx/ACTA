/*
 * Code Map: IPC Payload Validation
 * - validatePayloadDetailed: Validate message payload by ActaMessageType.
 * - validatePayload: Boolean wrapper around validatePayloadDetailed.
 *
 * CID Index:
 * CID:ipc-validator-payload-001 -> PayloadValidationResult
 * CID:ipc-validator-payload-002 -> validatePayloadDetailed
 * CID:ipc-validator-payload-003 -> validatePayload
 *
 * Quick lookup: rg -n "CID:ipc-validator-payload-" packages/ipc/src/validator/payload.ts
 */

import type { ActaMessageType } from '../types'
import {
  isNonEmptyString,
  isPlainObject,
  isStringArray,
  isValidTrustLevel,
  MAX_TASK_ATTACHMENT_PATH_CHARS,
  MAX_TASK_ATTACHMENTS,
  MAX_TASK_INPUT_CHARS,
} from './helpers'

// CID:ipc-validator-payload-001 - PayloadValidationResult
export type PayloadValidationResult =
  | { ok: true }
  | {
      ok: false
      code: string
      message: string
    }

// CID:ipc-validator-payload-002 - validatePayloadDetailed
export function validatePayloadDetailed(type: ActaMessageType, payload: unknown): PayloadValidationResult {
  if (type === 'task.request') {
    if (!isPlainObject(payload)) {
      return { ok: false, code: 'task.invalid_input', message: 'task.request payload must be an object' }
    }

    if (!isNonEmptyString(payload.input)) {
      return { ok: false, code: 'task.invalid_input', message: 'task.request payload must include non-empty input' }
    }

    if (payload.input.length > MAX_TASK_INPUT_CHARS) {
      return {
        ok: false,
        code: 'task.input_too_long',
        message: `task.request input exceeds max length (${MAX_TASK_INPUT_CHARS})`,
      }
    }

    if (payload.context !== undefined) {
      if (!isPlainObject(payload.context)) {
        return { ok: false, code: 'task.invalid_input', message: 'task.request context must be an object' }
      }

      if (payload.context.files !== undefined) {
        if (!isStringArray(payload.context.files)) {
          return { ok: false, code: 'task.invalid_input', message: 'task.request context.files must be an array of strings' }
        }
        if (payload.context.files.length > MAX_TASK_ATTACHMENTS) {
          return {
            ok: false,
            code: 'task.invalid_input',
            message: `task.request context.files exceeds max count (${MAX_TASK_ATTACHMENTS})`,
          }
        }
        for (const p of payload.context.files) {
          if (!isNonEmptyString(p)) {
            return { ok: false, code: 'task.invalid_input', message: 'task.request context.files contains an empty path' }
          }
          if (p.length > MAX_TASK_ATTACHMENT_PATH_CHARS) {
            return {
              ok: false,
              code: 'task.invalid_input',
              message: `task.request context.files contains a path exceeding max length (${MAX_TASK_ATTACHMENT_PATH_CHARS})`,
            }
          }
        }
      }

      if (payload.context.screen !== undefined && typeof payload.context.screen !== 'boolean') {
        return { ok: false, code: 'task.invalid_input', message: 'task.request context.screen must be boolean' }
      }

      if (payload.context.clipboard !== undefined && typeof payload.context.clipboard !== 'boolean') {
        return { ok: false, code: 'task.invalid_input', message: 'task.request context.clipboard must be boolean' }
      }
    }

    if (payload.trustLevel !== undefined && !isValidTrustLevel(payload.trustLevel)) {
      return { ok: false, code: 'task.invalid_input', message: 'task.request trustLevel must be low|medium|high' }
    }

    return { ok: true }
  }

  if (type === 'chat.request') {
    if (!isPlainObject(payload)) {
      return { ok: false, code: 'chat.invalid_input', message: 'chat.request payload must be an object' }
    }

    if (!isNonEmptyString(payload.input)) {
      return { ok: false, code: 'chat.invalid_input', message: 'chat.request payload must include non-empty input' }
    }

    if (payload.input.length > MAX_TASK_INPUT_CHARS) {
      return {
        ok: false,
        code: 'chat.input_too_long',
        message: `chat.request input exceeds max length (${MAX_TASK_INPUT_CHARS})`,
      }
    }

    if (payload.context !== undefined) {
      if (!isPlainObject(payload.context)) {
        return { ok: false, code: 'chat.invalid_input', message: 'chat.request context must be an object' }
      }

      if (payload.context.files !== undefined) {
        if (!isStringArray(payload.context.files)) {
          return { ok: false, code: 'chat.invalid_input', message: 'chat.request context.files must be an array of strings' }
        }
        if (payload.context.files.length > MAX_TASK_ATTACHMENTS) {
          return {
            ok: false,
            code: 'chat.invalid_input',
            message: `chat.request context.files exceeds max count (${MAX_TASK_ATTACHMENTS})`,
          }
        }
        for (const p of payload.context.files) {
          if (!isNonEmptyString(p)) {
            return { ok: false, code: 'chat.invalid_input', message: 'chat.request context.files contains an empty path' }
          }
          if (p.length > MAX_TASK_ATTACHMENT_PATH_CHARS) {
            return {
              ok: false,
              code: 'chat.invalid_input',
              message: `chat.request context.files contains a path exceeding max length (${MAX_TASK_ATTACHMENT_PATH_CHARS})`,
            }
          }
        }
      }
    }

    return { ok: true }
  }

  if (type === 'chat.response') {
    if (!isPlainObject(payload)) {
      return { ok: false, code: 'chat.invalid_payload', message: 'chat.response payload must be an object' }
    }
    if (!isNonEmptyString(payload.text)) {
      return { ok: false, code: 'chat.invalid_payload', message: 'chat.response requires text' }
    }
    if (payload.model !== undefined && typeof payload.model !== 'string') {
      return { ok: false, code: 'chat.invalid_payload', message: 'chat.response model must be string' }
    }
    if (payload.tokens !== undefined) {
      if (!isPlainObject(payload.tokens)) {
        return { ok: false, code: 'chat.invalid_payload', message: 'chat.response tokens must be an object' }
      }
      const tok = payload.tokens as Record<string, unknown>
      for (const key of ['prompt', 'completion', 'total']) {
        if (tok[key] !== undefined && typeof tok[key] !== 'number') {
          return { ok: false, code: 'chat.invalid_payload', message: `chat.response tokens.${key} must be number` }
        }
      }
    }
    return { ok: true }
  }

  if (type === 'chat.error') {
    if (!isPlainObject(payload)) {
      return { ok: false, code: 'chat.invalid_payload', message: 'chat.error payload must be an object' }
    }
    if (!isNonEmptyString(payload.message)) {
      return { ok: false, code: 'chat.invalid_payload', message: 'chat.error requires message' }
    }
    if (payload.details !== undefined && typeof payload.details !== 'string') {
      return { ok: false, code: 'chat.invalid_payload', message: 'chat.error details must be string' }
    }
    return { ok: true }
  }

  if (type === 'task.error') {
    if (!isPlainObject(payload)) return { ok: false, code: 'ipc.invalid_payload', message: 'task.error payload must be an object' }
    if (!isNonEmptyString(payload.taskId)) return { ok: false, code: 'ipc.invalid_payload', message: 'task.error requires taskId' }
    if (!isNonEmptyString(payload.code)) return { ok: false, code: 'ipc.invalid_payload', message: 'task.error requires code' }
    if (!isNonEmptyString(payload.message)) return { ok: false, code: 'ipc.invalid_payload', message: 'task.error requires message' }
    if (payload.stepId !== undefined && !isNonEmptyString(payload.stepId)) {
      return { ok: false, code: 'ipc.invalid_payload', message: 'task.error stepId must be string' }
    }
    if (payload.details !== undefined && typeof payload.details !== 'string') {
      return { ok: false, code: 'ipc.invalid_payload', message: 'task.error details must be string' }
    }
    return { ok: true }
  }

  if (type === 'task.stop') {
    if (!isPlainObject(payload)) {
      return { ok: false, code: 'task.invalid_input', message: 'task.stop payload must be an object' }
    }
    if (payload.correlationId !== undefined && !isNonEmptyString(payload.correlationId)) {
      return { ok: false, code: 'task.invalid_input', message: 'task.stop correlationId must be a non-empty string' }
    }
    return { ok: true }
  }

  if (type === 'permission.request') {
    if (!isPlainObject(payload)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request payload must be an object' }
    if (!isNonEmptyString(payload.id)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request requires id' }
    if (!isNonEmptyString(payload.tool)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request requires tool' }
    if (!isNonEmptyString(payload.action)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request requires action' }
    if (!isNonEmptyString(payload.reason)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request requires reason' }
    if (payload.domain !== undefined && !isNonEmptyString(payload.domain)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request domain must be string' }
    if (payload.scope !== undefined && !isNonEmptyString(payload.scope)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request scope must be string' }
    if (payload.risk !== undefined && typeof payload.risk !== 'string') return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request risk must be string' }
    if (payload.risks !== undefined && !Array.isArray(payload.risks)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request risks must be array' }
    if (typeof payload.reversible !== 'boolean') return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request reversible must be boolean' }
    if (payload.rememberDecision !== undefined && typeof payload.rememberDecision !== 'boolean') {
      return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request rememberDecision must be boolean' }
    }

    if (payload.cloud !== undefined) {
      if (!isPlainObject(payload.cloud)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request cloud must be object' }
      if (!isNonEmptyString(payload.cloud.provider)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request cloud.provider required' }
      if (payload.cloud.model !== undefined && !isNonEmptyString(payload.cloud.model)) {
        return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request cloud.model must be string' }
      }
      if (payload.cloud.warning !== undefined && typeof payload.cloud.warning !== 'string') {
        return { ok: false, code: 'ipc.invalid_payload', message: 'permission.request cloud.warning must be string' }
      }
    }

    return { ok: true }
  }

  if (type === 'permission.response') {
    if (!isPlainObject(payload)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.response payload must be an object' }
    if (!isNonEmptyString(payload.requestId)) return { ok: false, code: 'ipc.invalid_payload', message: 'permission.response requires requestId' }
    if (payload.decision !== 'allow' && payload.decision !== 'deny') {
      return { ok: false, code: 'ipc.invalid_payload', message: 'permission.response decision must be allow|deny' }
    }
    if (payload.remember !== undefined && typeof payload.remember !== 'boolean') {
      return { ok: false, code: 'ipc.invalid_payload', message: 'permission.response remember must be boolean' }
    }
    return { ok: true }
  }

  if (type === 'llm.healthCheck') {
    if (!isPlainObject(payload)) return { ok: false, code: 'ipc.invalid_payload', message: 'llm.healthCheck payload must be an object' }

    // Response payload shape (runtime -> UI)
    if (typeof (payload as any).ok === 'boolean') {
      if ((payload as any).models !== undefined && !isStringArray((payload as any).models)) {
        return { ok: false, code: 'ipc.invalid_payload', message: 'llm.healthCheck models must be an array of strings' }
      }
      if ((payload as any).error !== undefined) {
        if (!isPlainObject((payload as any).error)) {
          return { ok: false, code: 'ipc.invalid_payload', message: 'llm.healthCheck error must be an object' }
        }
        if (!isNonEmptyString((payload as any).error.message)) {
          return { ok: false, code: 'ipc.invalid_payload', message: 'llm.healthCheck error.message must be string' }
        }
        if ((payload as any).error.code !== undefined && typeof (payload as any).error.code !== 'string') {
          return { ok: false, code: 'ipc.invalid_payload', message: 'llm.healthCheck error.code must be string' }
        }
      }
      return { ok: true }
    }

    // Request payload shape (UI -> runtime)
    if ((payload as any).profileId !== undefined && !isNonEmptyString((payload as any).profileId)) {
      return { ok: false, code: 'ipc.invalid_payload', message: 'llm.healthCheck profileId must be string' }
    }
    if ((payload as any).config !== undefined && !isPlainObject((payload as any).config)) {
      return { ok: false, code: 'ipc.invalid_payload', message: 'llm.healthCheck config must be an object' }
    }
    return { ok: true }
  }

  return { ok: true }
}

// CID:ipc-validator-payload-003 - validatePayload
export function validatePayload(type: ActaMessageType, payload: unknown): boolean {
  return validatePayloadDetailed(type, payload).ok
}
