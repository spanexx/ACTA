/*
 * Code Map: Tool Execution Audit
 * - logExecutionAudit(): Formats tool execution data into a logging AuditEvent.
 *
 * CID Index:
 * CID:tools-registry-audit-001 -> logExecutionAudit
 *
 * Lookup: rg -n "CID:tools-registry-audit-" packages/tools/src/registry/audit.ts
 */

import type { ExecutionContext } from './types'
import { Logger, logAudit, AuditEvent } from '@acta/logging'

// CID:tools-registry-audit-001 - logExecutionAudit
// Purpose: Builds an audit event payload from tool execution context and emits it via logAudit.
// Uses: Logger, AuditEvent types from @acta/logging
// Used by: ToolRegistry.execute() after tool completion/failure
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
