/*
 * Code Map: IPC Package Entry
 * - IPC_VERSION constant
 * - Type exports from ./types
 * - Validator and adapter exports
 *
 * CID Index:
 * CID:ipc-index-001 -> IPC_VERSION constant
 * CID:ipc-index-002 -> type exports
 * CID:ipc-index-003 -> validator exports
 * CID:ipc-index-004 -> adapter exports
 *
 * Quick lookup: rg -n "CID:ipc-index-" /home/spanexx/Shared/Projects/ACTA/packages/ipc/src/index.ts
 */

// CID:ipc-index-001 - IPC_VERSION constant
// Purpose: Surface IPC package version
export const IPC_VERSION = "0.1.0"

// CID:ipc-index-002 - type exports
// Purpose: Re-export ActaMessage and IPC payload types
export type {
  ActaMessage,
  ActaMessageType,
  ChatError,
  ChatRequest,
  ChatResponse,
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
  LLMHealthCheckRequest,
  LLMHealthCheckPayload,
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

// CID:ipc-index-003 - validator exports
// Purpose: Re-export payload validation helpers
export { isValidActaMessage, validatePayload, validatePayloadDetailed, type PayloadValidationResult } from './validator'

// CID:ipc-index-004 - adapter exports
// Purpose: Re-export IPC adapter factory and interfaces
export { createIpcAdapter, type IpcAdapter, type IpcAdapterOptions } from './adapter'
