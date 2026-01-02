import { randomUUID } from 'node:crypto'
import { createLogger } from '@acta/logging'
import type { ActaMessage, ActaMessageType } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type PendingPermission = {
  resolve: (decision: PermissionDecisionType) => void
  timeout: ReturnType<typeof setTimeout>
}

export class PermissionCoordinator {
  private pendingPermissionByMsgId = new Map<string, PendingPermission>()
  private permissionMsgIdByRequestKey = new Map<string, string>()

  constructor(
    private opts: {
      getLogLevel: () => LogLevel
      broadcast: (msg: ActaMessage) => void
      emitMessage: <T>(
        type: ActaMessageType,
        payload: T,
        opts: { correlationId?: string; profileId?: string; replyTo?: string; source?: ActaMessage['source'] },
      ) => void
    },
  ) {}

  handlePermissionResponse(msg: ActaMessage): void {
    const logger = createLogger('ipc-ws', this.opts.getLogLevel())
    const payload = msg.payload as any

    const replyTo = typeof msg.replyTo === 'string' ? msg.replyTo : undefined
    const requestId = typeof payload?.requestId === 'string' ? payload.requestId : undefined

    let pendingMsgId: string | undefined = replyTo
    if (!pendingMsgId && requestId && typeof msg.correlationId === 'string') {
      const requestKey = `${msg.correlationId}:${requestId}`
      pendingMsgId = this.permissionMsgIdByRequestKey.get(requestKey)
    }

    if (!pendingMsgId) {
      logger.warn('IPC permission.response missing replyTo/requestId', {
        correlationId: msg.correlationId,
      })
      return
    }

    const pending = this.pendingPermissionByMsgId.get(pendingMsgId)
    if (!pending) {
      logger.warn('IPC permission.response has no pending request', {
        replyTo: pendingMsgId,
        correlationId: msg.correlationId,
      })
      return
    }

    clearTimeout(pending.timeout)
    this.pendingPermissionByMsgId.delete(pendingMsgId)

    const decisionRaw = payload?.decision
    const decision: PermissionDecisionType = decisionRaw === 'deny' ? 'deny' : 'allow'
    logger.info('IPC permission.response resolved', { replyTo: pendingMsgId, decision })
    pending.resolve(decision)
  }

  createAgentEventAdapter(opts: { correlationId: string; profileId: string }): (type: string, payload: any) => void {
    return (type: string, payload: any) => {
      switch (type) {
        case 'task.plan':
          this.opts.emitMessage('task.plan', payload, {
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          })
          return
        case 'task.step':
          this.opts.emitMessage('task.step', payload, {
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          })
          return
        case 'permission.request': {
          const req = payload as PermissionRequest
          const requestId = typeof req?.id === 'string' ? req.id : randomUUID()
          const requestKey = `${opts.correlationId}:${requestId}`

          const msgId = randomUUID()
          this.permissionMsgIdByRequestKey.set(requestKey, msgId)

          const msg: ActaMessage<PermissionRequest> = {
            id: msgId,
            type: 'permission.request',
            source: 'agent',
            timestamp: Date.now(),
            payload: req,
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          }

          this.opts.broadcast(msg)
          return
        }
        case 'task.result':
          this.opts.emitMessage('task.result', payload, {
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          })
          return
        case 'task.error':
          this.opts.emitMessage('task.error', payload, {
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          })
          return
        default:
          return
      }
    }
  }

  waitForPermission(opts: { correlationId: string }): (request: PermissionRequest) => Promise<PermissionDecisionType> {
    return async (request: PermissionRequest) => {
      const requestId = typeof request?.id === 'string' ? request.id : randomUUID()
      const requestKey = `${opts.correlationId}:${requestId}`

      const msgId = this.permissionMsgIdByRequestKey.get(requestKey) ?? randomUUID()
      this.permissionMsgIdByRequestKey.set(requestKey, msgId)

      const existing = this.pendingPermissionByMsgId.get(msgId)
      if (existing) {
        clearTimeout(existing.timeout)
        this.pendingPermissionByMsgId.delete(msgId)
      }

      return await new Promise<PermissionDecisionType>(resolve => {
        const timeout = setTimeout(() => {
          this.pendingPermissionByMsgId.delete(msgId)
          resolve('deny')
        }, 30_000)

        this.pendingPermissionByMsgId.set(msgId, { resolve, timeout })
      })
    }
  }
}
