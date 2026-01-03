import type { RuntimeTask } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

export type AgentTaskRunOptions = {
  task: RuntimeTask
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  logsDir?: string
  memoryDir?: string
  trustDir?: string
  emitEvent: (type: string, payload: any) => void
  waitForPermission: (request: PermissionRequest) => Promise<PermissionDecisionType>
  isCancelled?: () => boolean
}

export class AgentServiceBusyError extends Error {
  code = 'task.busy'

  constructor(message = 'A task is already running') {
    super(message)
    this.name = 'AgentServiceBusyError'
  }
}

type RunningTask = {
  task: RuntimeTask
  startedAt: number
  stopRequested: boolean
  promise: Promise<void>
}

export class AgentService {
  private running: RunningTask | null = null

  constructor(private runTask: (opts: AgentTaskRunOptions) => Promise<void>) {}

  isRunning(): boolean {
    return this.running !== null
  }

  getCurrentTask(): RuntimeTask | null {
    return this.running?.task ?? null
  }

  isStopRequested(): boolean {
    return Boolean(this.running?.stopRequested)
  }

  requestStop(opts?: { correlationId?: string }): boolean {
    if (!this.running) return false
    if (opts?.correlationId && this.running.task.correlationId !== opts.correlationId) return false
    this.running.stopRequested = true
    return true
  }

  async start(opts: AgentTaskRunOptions): Promise<void> {
    if (this.running) {
      throw new AgentServiceBusyError()
    }

    const running: RunningTask = {
      task: opts.task,
      startedAt: Date.now(),
      stopRequested: false,
      promise: Promise.resolve(),
    }

    this.running = running

    const promise = this.runTask({
      ...opts,
      isCancelled: () => {
        if (!this.running) return true
        if (this.running.task.correlationId !== opts.task.correlationId) return true
        return Boolean(this.running.stopRequested)
      },
    }).finally(() => {
      if (this.running?.task.correlationId === opts.task.correlationId) {
        this.running = null
      }
    })

    running.promise = promise
    return await promise
  }
}
