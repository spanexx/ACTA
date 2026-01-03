// IPC package entry (Phase-1 skeleton)
export const IPC_VERSION = "0.1.0"

export type {
  ActaMessage,
  ActaMessageType,
  TaskRequest,
  TaskStopRequest,
  RuntimeTask,
  AgentPlan,
  AgentStep,
  ToolResult,
  TaskPlanPayload,
  TaskStepPayload,
  TaskResultPayload,
  TaskErrorPayload,
  PermissionRequestPayload,
  PermissionResponsePayload,
  ProfileSummary,
  ProfileListPayload,
  ProfileCreateRequest,
  ProfileCreatePayload,
  ProfileDeleteRequest,
  ProfileDeletePayload,
  ProfileSwitchRequest,
  ProfileSwitchPayload,
  ProfileActivePayload,
  ProfileGetRequest,
  ProfileDoc,
  ProfileGetPayload,
  ProfileUpdateRequest,
  ProfileUpdatePayload,
} from './types'

export { isValidActaMessage, validatePayload, validatePayloadDetailed, type PayloadValidationResult } from './validator'
export { createIpcAdapter, type IpcAdapter, type IpcAdapterOptions } from './adapter'
