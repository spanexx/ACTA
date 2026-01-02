import { Injectable, NgZone } from '@angular/core'
import type { ActaMessage } from '@acta/ipc'
import { RuntimeIpcService } from '../runtime-ipc.service'
import type { PermissionDecision, PermissionRequestEvent } from '../models/ui.models'
import { ChatStateService } from './chat-state.service'
import { SessionService } from './session.service'
import { ToolOutputsStateService } from './tool-outputs-state.service'

@Injectable({ providedIn: 'root' })
export class PermissionStateService {
  open = false
  submitting = false
  request: PermissionRequestEvent | null = null
  decision: PermissionDecision = 'allow_once'
  remember = false

  private permissionUnsubscribe: (() => void) | null = null

  constructor(
    private zone: NgZone,
    private runtimeIpc: RuntimeIpcService,
    private session: SessionService,
    private chat: ChatStateService,
    private toolOutputs: ToolOutputsStateService,
  ) {
    this.attachPermissionListener()
  }

  handlePermissionRequestFromRuntime(msg: ActaMessage): void {
    if (msg.type !== 'permission.request') return

    const now = Date.now()
    const correlationId = typeof msg.correlationId === 'string' ? msg.correlationId : undefined
    if (!correlationId) return

    const p = msg.payload as any
    const req: PermissionRequestEvent = {
      id: msg.id,
      requestId: typeof p?.id === 'string' ? p.id : msg.id,
      correlationId,
      replyTo: msg.id,
      tool: String(p?.tool ?? 'tool'),
      action: typeof p?.action === 'string' ? p.action : undefined,
      scope: typeof p?.scope === 'string' ? p.scope : undefined,
      input: typeof p?.input === 'string' ? p.input : undefined,
      output: typeof p?.output === 'string' ? p.output : undefined,
      reason: String(p?.reason ?? 'Permission required'),
      risk: typeof p?.risk === 'string' ? p.risk : undefined,
      risks: Array.isArray(p?.risks) ? p.risks.map((r: any) => String(r)) : undefined,
      reversible: Boolean(p?.reversible ?? true),
      rememberDecision: true,
    }

    this.openWithRequest(req, now)
  }

  cancel(): void {
    void this.submit('deny')
  }

  async submit(decision: PermissionDecision): Promise<void> {
    if (!this.request) return
    if (this.submitting) return

    const request = this.request
    const remember = decision === 'allow_always' || this.remember

    this.submitting = true

    try {
      if (request.correlationId && request.replyTo) {
        const decisionType = decision === 'deny' ? 'deny' : 'allow'
        this.runtimeIpc.sendPermissionResponse(
          {
            requestId: request.requestId ?? request.id,
            decision: decisionType,
            remember,
          },
          {
            profileId: this.session.profileId,
            correlationId: request.correlationId,
            replyTo: request.replyTo,
          },
        )
      } else {
        await window.ActaAPI?.respondToPermission({
          requestId: request.id,
          decision,
          remember,
        })
      }
    } catch {
      // ignore (UI scaffold only)
    }

    this.submitting = false
    this.open = false
    this.request = null
    this.remember = false
    this.decision = 'allow_once'

    this.chat.addSystemMessage(`Permission decision for ${request.tool}: ${this.permissionDecisionLabel(decision)}.`)
    this.toolOutputs.applyPermissionDecision(request, decision, remember)
  }

  leadIcon(request: PermissionRequestEvent): string {
    if (request.cloud) return '☁️'
    if (request.tool.includes('convert')) return '📄'
    return '🛡️'
  }

  cloudLabel(request: PermissionRequestEvent): string {
    if (!request.cloud) return 'local'
    if (!request.cloud.model) return request.cloud.provider
    return `${request.cloud.provider} (${request.cloud.model})`
  }

  riskLabel(request: PermissionRequestEvent): string {
    const lines: string[] = []
    if (request.risk) lines.push(request.risk)
    if (request.risks?.length) lines.push(...request.risks)
    return lines.join(' • ')
  }

  trustModeLabel(level: number): string {
    if (level <= 0) return 'Deny (0)'
    if (level === 1) return 'Ask every time (1)'
    if (level === 2) return 'Ask once (2)'
    if (level === 3) return 'Allow (3)'
    return `Trust level ${level}`
  }

  primaryEffect(request: PermissionRequestEvent): string {
    if (request.tool.includes('file.read')) return 'Read the specified file'
    if (request.tool.includes('file.convert')) return 'Read the input file and write a converted output'
    if (request.tool.includes('file.write')) return 'Write a file to your system'
    return 'Execute the requested tool'
  }

  secondaryEffect(request: PermissionRequestEvent): string {
    if (request.cloud) {
      return `May send content to ${this.cloudLabel(request)}`
    }
    return 'Process it locally'
  }

  folderScope(request: PermissionRequestEvent): string | null {
    const basis = request.scope ?? request.input
    if (!basis) return null

    const normalized = basis.replace(/\\/g, '/')
    const idx = normalized.lastIndexOf('/')
    if (idx <= 0) return null

    return `${normalized.slice(0, idx)}/*`
  }

  permissionDecisionLabel(decision: PermissionDecision): string {
    if (decision === 'deny') return 'Deny'
    if (decision === 'allow_always') return 'Always allow'
    return 'Allow once'
  }

  private openWithRequest(req: PermissionRequestEvent, now: number): void {
    this.request = req
    this.decision = 'allow_once'
    this.remember = false
    this.open = true

    this.chat.addSystemMessage(`Permission requested for ${req.tool}.`, now)
    this.toolOutputs.trackPermissionRequest(req, now)
  }

  private attachPermissionListener(): void {
    if (!window.ActaAPI) return
    if (this.permissionUnsubscribe) return

    this.permissionUnsubscribe = window.ActaAPI.onPermissionRequest(req => {
      this.zone.run(() => {
        this.openWithRequest(req, Date.now())
      })
    })
  }
}
