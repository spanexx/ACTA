// IPC request validator stub (Phase-1)
// Provides runtime type guards; can be swapped for Zod later

import type { ActaMessage, ActaMessageType } from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

function isValidTrustLevel(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high'
}

const MAX_TASK_INPUT_CHARS = 20_000
const MAX_TASK_ATTACHMENTS = 50
const MAX_TASK_ATTACHMENT_PATH_CHARS = 500

export function isValidActaMessage(msg: unknown): msg is ActaMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof (msg as any).id === 'string' &&
    isValidMessageType((msg as any).type) &&
    isValidSource((msg as any).source) &&
    typeof (msg as any).timestamp === 'number' &&
    'payload' in (msg as any)
  )
}

function isValidMessageType(type: unknown): type is ActaMessageType {
  const valid: ActaMessageType[] = [
    'task.request',
    'task.stop',
    'task.plan',
    'task.step',
    'task.permission',
    'permission.request',
    'permission.response',
    'profile.list',
    'profile.create',
    'profile.delete',
    'profile.switch',
    'profile.active',
    'profile.get',
    'profile.update',
    'task.result',
    'task.error',
    'memory.read',
    'memory.write',
    'trust.prompt',
    'system.event',
  ]
  return typeof type === 'string' && valid.includes(type as ActaMessageType)
}

function isValidSource(source: unknown): source is 'ui' | 'agent' | 'tool' | 'system' {
  const valid = ['ui', 'agent', 'tool', 'system']
  return typeof source === 'string' && valid.includes(source)
}

export type PayloadValidationResult =
  | { ok: true }
  | {
      ok: false
      code: string
      message: string
    }

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

  return { ok: true }
}

export function validatePayload(type: ActaMessageType, payload: unknown): boolean {
  return validatePayloadDetailed(type, payload).ok
}
