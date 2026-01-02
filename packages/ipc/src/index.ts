// IPC package entry (Phase-1 skeleton)
export const IPC_VERSION = "0.1.0"

export type {
  ActaMessage,
  ActaMessageType,
  TaskRequest,
  AgentPlan,
  AgentStep,
  ToolResult,
  TaskPlanPayload,
  TaskStepPayload,
  TaskResultPayload,
  TaskErrorPayload,
  PermissionRequestPayload,
} from './types'

export { isValidActaMessage, validatePayload } from './validator'
export { createIpcAdapter, type IpcAdapter, type IpcAdapterOptions } from './adapter'
