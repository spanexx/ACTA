/*
 * Code Map: IPC Message Router
 * - createRuntimeIpcRouter: Routes IPC messages to appropriate handlers
 * 
 * CID Index:
 * CID:router-001 -> createRuntimeIpcRouter
 * 
 * Quick lookup: rg -n "CID:router-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/server/router.ts
 */

import { createLogger } from '@acta/logging'
import type {
  ActaMessage,
  ChatRequest,
  TaskRequest,
  TaskStopRequest,
  LLMHealthCheckRequest,
  ProfileCreateRequest,
  ProfileDeleteRequest,
  ProfileSwitchRequest,
  ProfileGetRequest,
  ProfileUpdateRequest,
} from '@acta/ipc'

import type { PermissionCoordinator } from '../permission-coordinator'
import type { ProfileHandlers } from './profile-handlers'
import type { TaskHandlers } from './task-handlers'

// CID:router-001 - createRuntimeIpcRouter
// Purpose: Create message router that dispatches IPC messages to handlers
// Uses: Logging, message types, handler interfaces
// Used by: Runtime core server for message processing
export function createRuntimeIpcRouter(opts: {
  getLogLevel: () => 'debug' | 'info' | 'warn' | 'error'
  profileHandlers: ProfileHandlers
  taskHandlers: TaskHandlers
  permissionCoordinator: PermissionCoordinator
}): (msg: ActaMessage) => Promise<void> {
  return async (msg: ActaMessage): Promise<void> => {
    const logger = createLogger('ipc-ws', opts.getLogLevel())
    switch (msg.type) {
      case 'task.request':
        logger.info('IPC received task.request', { correlationId: msg.correlationId, profileId: msg.profileId })
        await opts.taskHandlers.handleTaskRequest(msg as ActaMessage<TaskRequest>)
        return
      case 'chat.request':
        logger.info('IPC received chat.request', { correlationId: msg.correlationId, profileId: msg.profileId })
        await opts.taskHandlers.handleChatRequest(msg as ActaMessage<ChatRequest>)
        return
      case 'task.stop':
        await opts.taskHandlers.handleTaskStop(msg as ActaMessage<TaskStopRequest>)
        return
      case 'permission.response':
        opts.permissionCoordinator.handlePermissionResponse(msg)
        return
      case 'profile.list':
        await opts.profileHandlers.handleProfileList(msg)
        return
      case 'profile.create':
        await opts.profileHandlers.handleProfileCreate(msg as ActaMessage<ProfileCreateRequest>)
        return
      case 'profile.delete':
        await opts.profileHandlers.handleProfileDelete(msg as ActaMessage<ProfileDeleteRequest>)
        return
      case 'profile.switch':
        await opts.profileHandlers.handleProfileSwitch(msg as ActaMessage<ProfileSwitchRequest>)
        return
      case 'profile.active':
        await opts.profileHandlers.handleProfileActive(msg)
        return
      case 'profile.get':
        await opts.profileHandlers.handleProfileGet(msg as ActaMessage<ProfileGetRequest>)
        return
      case 'profile.update':
        await opts.profileHandlers.handleProfileUpdate(msg as ActaMessage<ProfileUpdateRequest>)
        return
      case 'llm.healthCheck':
        await opts.profileHandlers.handleLLMHealthCheck(msg as ActaMessage<LLMHealthCheckRequest>)
        return
      default:
        logger.warn('IPC received unsupported message type', { type: msg.type })
        return
    }
  }
}
