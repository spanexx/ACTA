import { randomUUID } from 'node:crypto'
import { createLogger } from '@acta/logging'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ActaMessage, ActaMessageType, PermissionResponsePayload } from '@acta/ipc'
import { RuleStore, type PermissionDecisionType, type PermissionRequest, type TrustRule } from '@acta/trust'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type PendingPermission = {
  resolve: (decision: PermissionDecisionType) => void
  timeout: ReturnType<typeof setTimeout>
}

type PendingPermissionContext = {
  request: PermissionRequest
  correlationId?: string
  profileId?: string
}

export class PermissionCoordinator {
  private pendingPermissionByMsgId = new Map<string, PendingPermission>()
  private permissionMsgIdByRequestKey = new Map<string, string>()
  private pendingContextByMsgId = new Map<string, PendingPermissionContext>()

  constructor(
    private opts: {
      getLogLevel: () => LogLevel
      broadcast: (msg: ActaMessage) => void
      emitMessage: <T>(
        type: ActaMessageType,
        payload: T,
        opts: { correlationId?: string; profileId?: string; replyTo?: string; source?: ActaMessage['source'] },
      ) => void
      getLogsDir?: (profileId: string) => Promise<string>
      getTrustDir?: (profileId: string) => Promise<string>
    },
  ) {}

  private async appendAuditLog(opts: { profileId?: string; event: any }): Promise<void> {
    const profileId = opts.profileId
    if (!profileId || !this.opts.getLogsDir) return

    try {
      const logsDir = await this.opts.getLogsDir(profileId)
      const filePath = path.join(logsDir, 'audit.log')
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.appendFile(filePath, JSON.stringify(opts.event) + '\n', 'utf8')
    } catch {
      return
    }
  }

  private async persistRememberedRule(opts: {
    profileId?: string
    request: PermissionRequest
    decision: PermissionDecisionType
    remember: boolean
  }): Promise<void> {
    if (!opts.remember) return
    if (!opts.profileId || !this.opts.getTrustDir) return
    if (opts.decision !== 'allow' && opts.decision !== 'deny') return

    try {
      const trustDir = await this.opts.getTrustDir(opts.profileId)
      const store = new RuleStore({ profileTrustDir: trustDir })

      const requestScope = typeof opts.request.scope === 'string' ? opts.request.scope : undefined
      let scopePrefix: string | undefined = undefined
      if (requestScope) {
        const normalized = requestScope.replace(/\\/g, '/')
        const idx = normalized.lastIndexOf('/')
        scopePrefix = idx > 0 ? normalized.slice(0, idx + 1) : normalized
      }

      const rule: Omit<TrustRule, 'id' | 'createdAt'> = {
        tool: opts.request.tool,
        scopePrefix,
        decision: opts.decision,
        remember: 'persistent',
      }

      const existingRules = await store.listRules()
      const existing = existingRules.find(r => r.tool === rule.tool && r.scopePrefix === rule.scopePrefix)
      if (existing) {
        await store.upsertRule({
          ...existing,
          decision: rule.decision,
          remember: rule.remember,
        })
      } else {
        await store.addRule(rule)
      }
    } catch {
      return
    }
  }

  async handlePermissionResponse(msg: ActaMessage): Promise<void> {
    const logger = createLogger('ipc-ws', this.opts.getLogLevel())
    const payload = msg.payload as PermissionResponsePayload | any

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

    const pendingCtx = this.pendingContextByMsgId.get(pendingMsgId)
    this.pendingContextByMsgId.delete(pendingMsgId)

    clearTimeout(pending.timeout)
    this.pendingPermissionByMsgId.delete(pendingMsgId)

    const decisionRaw = payload?.decision
    const decision: PermissionDecisionType = decisionRaw === 'deny' ? 'deny' : 'allow'
    const remember = Boolean(payload?.remember)

    if (pendingCtx?.request) {
      await this.appendAuditLog({
        profileId: pendingCtx.profileId,
        event: {
          type: 'permission.decision',
          timestamp: Date.now(),
          correlationId: pendingCtx.correlationId ?? msg.correlationId,
          profileId: pendingCtx.profileId,
          requestId: pendingCtx.request.id,
          tool: pendingCtx.request.tool,
          scope: pendingCtx.request.scope,
          action: pendingCtx.request.action,
          decision,
          source: 'prompt',
          remember,
        },
      })

      await this.persistRememberedRule({
        profileId: pendingCtx.profileId,
        request: pendingCtx.request,
        decision,
        remember,
      })
    }

    logger.info('IPC permission.response resolved', { replyTo: pendingMsgId, decision })
    pending.resolve(decision)
  }

  createAgentEventAdapter(opts: { correlationId: string; profileId: string; taskId: string }): (type: string, payload: any) => void {
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

          this.pendingContextByMsgId.set(msgId, {
            request: req,
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          })

          void this.appendAuditLog({
            profileId: opts.profileId,
            event: {
              type: 'permission.request',
              timestamp: Date.now(),
              correlationId: opts.correlationId,
              profileId: opts.profileId,
              requestId,
              tool: req?.tool,
              scope: req?.scope,
              action: req?.action,
              reason: req?.reason,
              source: 'prompt',
            },
          })

          return
        }
        case 'task.result':
          this.opts.emitMessage('task.result', payload, {
            correlationId: opts.correlationId,
            profileId: opts.profileId,
          })
          return
        case 'task.error':
          this.opts.emitMessage('task.error', { taskId: opts.taskId, ...(payload ?? {}) }, {
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
        this.pendingContextByMsgId.delete(msgId)
      }

      return await new Promise<PermissionDecisionType>(resolve => {
        const timeout = setTimeout(() => {
          this.pendingPermissionByMsgId.delete(msgId)
          const pendingCtx = this.pendingContextByMsgId.get(msgId)
          this.pendingContextByMsgId.delete(msgId)

          void this.appendAuditLog({
            profileId: pendingCtx?.profileId,
            event: {
              type: 'permission.timeout',
              timestamp: Date.now(),
              correlationId: pendingCtx?.correlationId ?? opts.correlationId,
              profileId: pendingCtx?.profileId,
              requestId: pendingCtx?.request?.id,
              tool: pendingCtx?.request?.tool,
              scope: pendingCtx?.request?.scope,
              action: pendingCtx?.request?.action,
              decision: 'deny',
              source: 'prompt',
            },
          })

          resolve('deny')
        }, 30_000)

        this.pendingPermissionByMsgId.set(msgId, { resolve, timeout })
        this.pendingContextByMsgId.set(msgId, { request, correlationId: opts.correlationId, profileId: request.profileId })
      })
    }
  }
}
