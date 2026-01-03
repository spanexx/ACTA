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
import type {
  ActaMessage,
  ActaMessageType,
  ChatError,
  ChatRequest,
  ChatResponse,
  RuntimeTask,
  TaskErrorPayload,
  TaskRequest,
  TaskStopRequest,
} from '@acta/ipc'

import type { LLMRequest } from '@acta/llm'

import { AgentServiceBusyError, type AgentService } from '../../agent.service'
import type { ProfileService } from '../../profile.service'
import type { PermissionCoordinator } from '../permission-coordinator'
import { createTaskLLMRouter } from '../task/llm-router'
import { createPlanningLLM } from '../task/planning-llm'
import { buildTrustProfile } from '../task/trust-profile'
import { createTrustEvaluator } from '../task/trust'

export type EmitMessage = <T>(
  type: ActaMessageType,
  payload: T,
  opts: { correlationId?: string; profileId?: string; replyTo?: string; source?: ActaMessage['source'] },
) => void

export type TaskHandlers = {
  handleTaskRequest: (msg: ActaMessage<TaskRequest>) => Promise<void>
  handleTaskStop: (msg: ActaMessage<TaskStopRequest>) => Promise<void>
  handleChatRequest: (msg: ActaMessage<ChatRequest>) => Promise<void>
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

      logger.info('task.request handling', {
        lane: 'task',
        correlationId,
        profileId,
        hasAttachments: attachments.length > 0,
      })

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
          profileService: opts.profileService,
          emitEvent,
          waitForPermission: opts.permissionCoordinator.waitForPermission({ correlationId }),
        })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string'
                ? String((err as any).message)
                : String(err)

        const details = (() => {
          if (err instanceof Error) return typeof err.stack === 'string' && err.stack.length ? err.stack : err.message
          try {
            return JSON.stringify(err)
          } catch {
            return String(err)
          }
        })()
        logger.error('task.request failed', { correlationId, profileId, message, details })

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
                details,
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

    handleChatRequest: async (msg: ActaMessage<ChatRequest>): Promise<void> => {
      const cfg = loadConfig()
      const profileId = msg.profileId ?? opts.profileService.getActiveProfileId() ?? cfg.profileId
      const correlationId = msg.correlationId ?? msg.id

      if (!profileId) {
        opts.emitMessage(
          'chat.error',
          { message: 'No active profile available to execute chat request' } satisfies ChatError,
          { correlationId, source: 'system', replyTo: msg.id },
        )
        return
      }

      let logsDir: string | undefined
      let trustDir: string | undefined
      try {
        logsDir = await opts.profileService.getLogsDir(profileId)
      } catch {
        logsDir = opts.profileService.getActiveLogsDir() ?? undefined
      }
      try {
        trustDir = await opts.profileService.getTrustDir(profileId)
      } catch {
        trustDir = undefined
      }

      const logger = createLogger('chat-request', cfg.logLevel, logsDir ? { dir: logsDir } : undefined)

      logger.info('chat.request handling', {
        lane: 'chat',
        correlationId,
        profileId,
        hasAttachments: (msg.payload?.context?.files?.length ?? 0) > 0,
      })

      const profileDoc = await opts.profileService.getProfile(profileId)
      const llmRouter = createTaskLLMRouter(profileDoc)

      const pseudoTaskId = `chat:${msg.id}`
      const trustProfile = buildTrustProfile(
        {
          taskId: pseudoTaskId,
          correlationId,
          profileId,
          input: msg.payload?.input ?? '',
          attachments: msg.payload?.context?.files,
        },
        profileDoc,
      )

      const evaluatePermission = await createTrustEvaluator({
        task: { correlationId, profileId },
        logger,
        logsDir,
        trustDir,
        profile: trustProfile,
      })

      const emitEvent = opts.permissionCoordinator.createAgentEventAdapter({
        correlationId,
        profileId,
        taskId: pseudoTaskId,
      })

      const planningLLM = createPlanningLLM({
        llmRouter,
        profileDoc,
        task: { taskId: pseudoTaskId, correlationId, profileId },
        logger,
        profile: trustProfile,
        emitEvent,
        waitForPermission: opts.permissionCoordinator.waitForPermission({ correlationId }),
        evaluatePermission,
      })

      const attachments = msg.payload?.context?.files ?? []
      const llmRequest: LLMRequest = {
        system:
          'You are Acta in Chat mode. Respond conversationally. Do not create plans, do not mention tool execution, and do not claim to have accessed files unless their contents are provided.',
        prompt:
          attachments.length > 0
            ? `${msg.payload.input}\n\nContext (file paths only):\n${attachments.map(p => `- ${p}`).join('\n')}`
            : msg.payload.input,
        maxTokens: profileDoc.llm?.defaults?.maxTokens ?? 512,
        temperature: profileDoc.llm?.defaults?.temperature ?? 0.2,
        metadata: {
          profileId,
          requestId: correlationId,
          lane: 'chat',
        },
      }

      try {
        const timeoutMs = 30_000
        let timeout: NodeJS.Timeout | undefined
        try {
          const res = await Promise.race([
            planningLLM.generate(llmRequest, {
              adapterId: profileDoc.llm?.adapterId,
              model: profileDoc.llm?.model,
            }),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => {
                reject(new Error(`Chat request timed out after ${timeoutMs}ms`))
              }, timeoutMs)
            }),
          ])

          const payload: ChatResponse = {
            text: res.text,
            model: res.model,
            tokens: res.tokens,
          }

          opts.emitMessage('chat.response', payload, {
            correlationId,
            profileId,
            replyTo: msg.id,
            source: 'agent',
          })
        } finally {
          if (timeout) clearTimeout(timeout)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const details = err instanceof Error ? (typeof err.stack === 'string' ? err.stack : undefined) : undefined

        const payload: ChatError = {
          message,
          details,
        }

        opts.emitMessage('chat.error', payload, {
          correlationId,
          profileId,
          replyTo: msg.id,
          source: 'system',
        })
      }
    },
  }
}
