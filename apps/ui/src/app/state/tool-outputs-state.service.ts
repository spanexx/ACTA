import { Injectable } from '@angular/core'
import type { ActaMessage } from '@acta/ipc'
import type {
  PermissionDecision,
  PermissionRequestEvent,
  ToolOutputEntry,
  ToolOutputFilter,
  ToolOutputStatus,
} from '../models/ui.models'

@Injectable({ providedIn: 'root' })
export class ToolOutputsStateService {
  toolOutputs: ToolOutputEntry[] = []
  toolFilter: ToolOutputFilter = 'all'
  toolSearch = ''

  statusIcon(status: ToolOutputStatus): string {
    switch (status) {
      case 'waiting_permission':
        return '🔐'
      case 'running':
        return '🔄'
      case 'completed':
        return '✅'
      case 'error':
        return '❌'
    }
  }

  statusLabel(status: ToolOutputStatus): string {
    switch (status) {
      case 'waiting_permission':
        return 'Waiting permission'
      case 'running':
        return 'Running'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Error'
    }
  }

  getVisible(): ToolOutputEntry[] {
    const search = this.toolSearch.trim().toLowerCase()

    return this.toolOutputs
      .filter(out => {
        if (this.toolFilter === 'all') return true
        if (this.toolFilter === 'active') {
          return out.status === 'running' || out.status === 'waiting_permission'
        }
        if (this.toolFilter === 'completed') return out.status === 'completed'
        return out.status === 'error'
      })
      .filter(out => {
        if (!search) return true

        const haystack = [
          out.tool,
          out.scope,
          out.input,
          out.reason,
          out.preview,
          out.error,
          ...(out.artifacts?.map(a => a.path) ?? []),
        ]
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
          .toLowerCase()

        return haystack.includes(search)
      })
  }

  clearCompleted(): void {
    this.toolOutputs = this.toolOutputs.filter(out => out.status !== 'completed')
  }

  exportAll(): void {
    const json = this.formatJson(this.toolOutputs.map(({ expanded, ...rest }) => rest))

    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `acta-tool-outputs-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      this.copyToClipboard(json)
    }
  }

  toggleRaw(id: string): void {
    this.toolOutputs = this.toolOutputs.map(out => {
      if (out.id !== id) return out
      return { ...out, expanded: !out.expanded }
    })
  }

  copyJson(value: unknown): void {
    this.copyToClipboard(this.formatJson(value))
  }

  copyToClipboard(text: string): void {
    void navigator.clipboard?.writeText(text)
  }

  formatJson(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  isToolRunActive(): boolean {
    return this.toolOutputs.some(out => out.status === 'running' || out.status === 'waiting_permission')
  }

  trackPermissionRequest(req: PermissionRequestEvent, now: number): void {
    const alreadyTracked = this.toolOutputs.some(out => out.id === req.id)
    if (alreadyTracked) return

    const entry: ToolOutputEntry = {
      id: req.id,
      timestamp: now,
      tool: req.tool,
      status: 'waiting_permission',
      scope: req.scope,
      input: req.input,
      reason: req.reason,
      preview: 'Permission required to proceed.',
      raw: req,
      expanded: false,
    }

    this.toolOutputs = [entry, ...this.toolOutputs]
  }

  applyPermissionDecision(request: PermissionRequestEvent, decision: PermissionDecision, remember: boolean): void {
    this.toolOutputs = this.toolOutputs.map(out => {
      if (out.id !== request.id) return out
      if (decision === 'deny') {
        return {
          ...out,
          status: 'error',
          error: 'Permission denied',
          preview: 'Denied by user.',
          raw: { ...(out.raw as object), decision },
        }
      }

      return {
        ...out,
        status: 'running',
        preview: 'Permission granted. Awaiting runtime…',
        progress: out.progress ?? 0,
        raw: { ...(out.raw as object), decision, remember },
      }
    })
  }

  handleTaskStepMessage(msg: ActaMessage): void {
    if (msg.type !== 'task.step') return

    const correlationId = msg.correlationId
    if (typeof correlationId !== 'string' || !correlationId.length) return

    const now = Date.now()
    const step = msg.payload as any
    const stepId = String(step?.stepId ?? '')
    const status = String(step?.status ?? '')
    if (!stepId.length) return

    const mappedStatus: 'running' | 'completed' | 'error' | null =
      status === 'in-progress'
        ? 'running'
        : status === 'completed'
          ? 'completed'
          : status === 'failed'
            ? 'error'
            : status === 'start'
              ? 'running'
              : status === 'error'
                ? 'error'
                : null

    if (!mappedStatus) return

    const tool = String(step?.tool ?? 'tool')
    const reason = typeof step?.intent === 'string' ? step.intent : undefined

    const stepInput = step?.input
    const input = typeof stepInput === 'string' ? stepInput : typeof stepInput?.text === 'string' ? stepInput.text : undefined
    const scope =
      typeof stepInput?.scope === 'string'
        ? stepInput.scope
        : typeof stepInput?.path === 'string'
          ? stepInput.path
          : typeof stepInput?.file === 'string'
            ? stepInput.file
            : undefined

    const stepProgressRaw = step?.progress
    const progress =
      typeof stepProgressRaw === 'number'
        ? Math.max(0, Math.min(100, stepProgressRaw <= 1 ? Math.round(stepProgressRaw * 100) : Math.round(stepProgressRaw)))
        : undefined

    const stepOutput = step?.output
    const outputPreview = typeof stepOutput === 'string' ? stepOutput : typeof stepOutput?.summary === 'string' ? stepOutput.summary : undefined

    const outputId = `${correlationId}:${stepId}`
    const existing = this.toolOutputs.find(o => o.id === outputId)

    const entry: ToolOutputEntry = {
      id: outputId,
      timestamp: now,
      tool,
      status: mappedStatus,
      scope,
      input,
      reason,
      progress,
      preview:
        mappedStatus === 'error'
          ? String(step?.failureReason ?? step?.error ?? 'error')
          : mappedStatus === 'completed'
            ? outputPreview
              ? `Completed: ${outputPreview}`
              : 'Completed'
            : 'Running',
      error: step?.failureReason ?? step?.error,
      raw: step,
      expanded: existing?.expanded ?? false,
      artifacts: Array.isArray(step?.artifacts) ? step.artifacts.map((p: any) => ({ path: String(p) })) : undefined,
    }

    this.toolOutputs = [...this.toolOutputs.filter(o => o.id !== outputId), entry].sort((a, b) => a.timestamp - b.timestamp)
  }
}
