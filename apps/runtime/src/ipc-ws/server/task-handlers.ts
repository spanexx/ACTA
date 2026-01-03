/*
 * Code Map: Task Message Handlers
 * - createTaskHandlers: Factory for task operation handlers
 * - handleTaskRequest: Execute task with permission coordination
 * - handleTaskStop: Stop running task by correlation ID
 * 
 * CID Index:
 * CID:task-handlers-001 -> createTaskHandlers
 * CID:task-handlers-002 -> handleTaskRequest
 * CID:task-handlers-003 -> handleTaskStop
 * 
 * Quick lookup: rg -n "CID:task-handlers-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/server/task-handlers.ts
 */

import { loadConfig } from '@acta/core'
import { createLogger } from '@acta/logging'
import type { ActaMessage, ActaMessageType, RuntimeTask, TaskErrorPayload, TaskRequest, TaskStopRequest } from '@acta/ipc'

import { AgentServiceBusyError, type AgentService } from '../../agent.service'
import type { ProfileService } from '../../profile.service'
import type { PermissionCoordinator } from '../permission-coordinator'

export type EmitMessage = <T>(
  type: ActaMessageType,
  payload: T,
  opts: { correlationId?: string; profileId?: string; replyTo?: string; source?: ActaMessage['source'] },
) => void

export type TaskHandlers = {
  handleTaskRequest: (msg: ActaMessage<TaskRequest>) => Promise<void>
  handleTaskStop: (msg: ActaMessage<TaskStopRequest>) => Promise<void>
}

// CID:task-handlers-001 - createTaskHandlers
// Purpose: Factory function creating task execution handlers
// Uses: ProfileService, AgentService, PermissionCoordinator, emitMessage callback
// Used by: Runtime core server during initialization
export function createTaskHandlers(opts: {
  profileService: ProfileService
  agentService: AgentService
  permissionCoordinator: PermissionCoordinator
  emitMessage: EmitMessage
}): TaskHandlers {
  return {
    // CID:task-handlers-002 - handleTaskRequest
    // Purpose: Execute task with profile resolution, directory setup, and permission coordination
    // Uses: Config loading, ProfileService directories, AgentService, PermissionCoordinator
    // Used by: Router for task.request message type
    handleTaskRequest: async (msg: ActaMessage<TaskRequest>): Promise<void> => {
      const cfg = loadConfig()
      const profileId = msg.profileId ?? opts.profileService.getActiveProfileId() ?? cfg.profileId
      const correlationId = msg.correlationId ?? msg.id

      if (!profileId) {
        const payload: TaskErrorPayload = {
          taskId: msg.id,
          code: 'task.missing_profile',
          message: 'No active profile available to execute task',
        }
        opts.emitMessage('task.error', payload, { correlationId, source: 'system', replyTo: msg.id })
        return
      }

      let logsDir: string | undefined
      let memoryDir: string | undefined
      let trustDir: string | undefined
      try {
        logsDir = await opts.profileService.getLogsDir(profileId)
      } catch {
        logsDir = opts.profileService.getActiveLogsDir() ?? undefined
      }
      try {
        memoryDir = await opts.profileService.getMemoryDir(profileId)
      } catch {
        memoryDir = opts.profileService.getActiveMemoryDir() ?? undefined
      }

      try {
        trustDir = await opts.profileService.getTrustDir(profileId)
      } catch {
        trustDir = undefined
      }

      const logger = createLogger('task-request', cfg.logLevel, logsDir ? { dir: logsDir } : undefined)

      const attachments = msg.payload?.context?.files ?? []
      const task: RuntimeTask = {
        taskId: msg.id,
        correlationId,
        profileId,
        input: msg.payload.input,
        attachments: attachments.length ? attachments : undefined,
      }

      try {
        const emitEvent = opts.permissionCoordinator.createAgentEventAdapter({
          correlationId,
          profileId,
          taskId: msg.id,
        })

        await opts.agentService.start({
          task,
          logLevel: cfg.logLevel,
          logsDir,
          memoryDir,
          trustDir,
          emitEvent,
          waitForPermission: opts.permissionCoordinator.waitForPermission({ correlationId }),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('task.request failed', { correlationId, profileId, message })

        const payload: TaskErrorPayload =
          err instanceof AgentServiceBusyError
            ? {
                taskId: msg.id,
                code: 'task.busy',
                message: 'A task is already running',
              }
            : {
                taskId: msg.id,
                code: 'task.failed',
                message,
              }

        opts.emitMessage('task.error', payload, {
          correlationId,
          profileId,
          source: 'system',
          replyTo: msg.id,
        })
      }
    },

    // CID:task-handlers-003 - handleTaskStop
    // Purpose: Stop running task by correlation ID with confirmation
    // Uses: AgentService requestStop, config loading
    // Used by: Router for task.stop message type
    handleTaskStop: async (msg: ActaMessage<TaskStopRequest>): Promise<void> => {
      const cfg = loadConfig()
      const logger = createLogger('task-stop', cfg.logLevel)

      const correlationId =
        typeof msg.payload?.correlationId === 'string' ? msg.payload.correlationId : msg.correlationId

      const ok = opts.agentService.requestStop({ correlationId: correlationId ?? undefined })
      logger.info('task.stop received', { correlationId, ok })

      opts.emitMessage(
        'system.event',
        { event: 'task.stop', ok, correlationId },
        {
          source: 'system',
          replyTo: msg.id,
          correlationId: msg.correlationId,
          profileId: msg.profileId,
        },
      )
    },
  }
}
