import type { RuntimeTask } from '@acta/ipc'
import type { PermissionDecisionType, PermissionRequest } from '@acta/trust'

/**
 * Code Map: AgentService (Task execution manager)
 * - CID:agent-service-001 → Task run options interface
 * - CID:agent-service-002 → Busy error class
 * - CID:agent-service-003 → Running task type
 * - CID:agent-service-004 → Main service class
 * - CID:agent-service-005 → State query methods
 * - CID:agent-service-006 → Stop request handling
 * - CID:agent-service-007 → Task execution lifecycle
 * 
 * Quick lookup: grep -n "CID:agent-service-" apps/runtime/src/agent.service.ts
 */

// CID:agent-service-001 - Task run options interface
// Purpose: Defines configuration options for running a task
// Uses: RuntimeTask, PermissionRequest, PermissionDecisionType types
// Used by: AgentService.start method and task handlers
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

// CID:agent-service-002 - Busy error class
// Purpose: Custom error when task is already running
// Uses: Error base class, custom code property
// Used by: AgentService.start when concurrent execution attempted
export class AgentServiceBusyError extends Error {
  code = 'task.busy'

  constructor(message = 'A task is already running') {
    super(message)
    this.name = 'AgentServiceBusyError'
  }
}

// CID:agent-service-003 - Running task type
// Purpose: Internal state tracking for active task execution
// Uses: RuntimeTask, Date.now(), Promise<void>
// Used by: AgentService class for state management
type RunningTask = {
  task: RuntimeTask
  startedAt: number
  stopRequested: boolean
  promise: Promise<void>
}

// CID:agent-service-004 - Main service class
// Purpose: Manages single task execution with concurrency control
// Uses: RunningTask type, runTask function injection
// Used by: RuntimeWsIpcServerCore, task handlers, profile handlers
export class AgentService {
  private running: RunningTask | null = null

  constructor(private runTask: (opts: AgentTaskRunOptions) => Promise<void>) {}

  // CID:agent-service-005 - State query methods
  // Purpose: Provide read-only access to current execution state
  // Uses: RunningTask state, optional chaining
  // Used by: RuntimeWsIpcServerCore for profile switching and status checks
  isRunning(): boolean {
    return this.running !== null
  }

  getCurrentTask(): RuntimeTask | null {
    return this.running?.task ?? null
  }

  isStopRequested(): boolean {
    return Boolean(this.running?.stopRequested)
  }

  // CID:agent-service-006 - Stop request handling
  // Purpose: Request graceful task termination with correlation validation
  // Uses: RunningTask state, correlation ID matching
  // Used by: RuntimeWsIpcServerCore task.stop handler
  requestStop(opts?: { correlationId?: string }): boolean {
    if (!this.running) return false
    if (opts?.correlationId && this.running.task.correlationId !== opts.correlationId) return false
    this.running.stopRequested = true
    return true
  }

  // CID:agent-service-007 - Task execution lifecycle
  // Purpose: Execute single task with concurrency control and cleanup
  // Uses: AgentTaskRunOptions, RunningTask state, Promise.finally for cleanup
  // Used by: RuntimeWsIpcServerCore task.request handler
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
