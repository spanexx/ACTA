import type { ExecutionContext } from './types'
import { Logger, logAudit, AuditEvent } from '@acta/logging'

export function logExecutionAudit(
  logger: Logger,
  event: {
    toolId: string
    stepId: string
    success: boolean
    artifacts?: string[]
    output?: any
    error?: string
    duration: number
    context: ExecutionContext
  },
): void {
  const auditEvent: AuditEvent = {
    type: 'tool_execution',
    timestamp: Date.now(),
    profileId: event.context.profileId,
    tool: event.toolId,
    decision: event.success ? 'allowed' : 'failed',
    details: {
      stepId: event.stepId,
      taskId: event.context.taskId,
      trustLevel: event.context.trustLevel,
      workingDir: event.context.workingDir,
      dryRun: event.context.dryRun,
      duration: event.duration,
      artifacts: event.artifacts,
      hasOutput: event.output !== undefined,
      error: event.error,
    },
  }

  logAudit(logger, auditEvent)
}
