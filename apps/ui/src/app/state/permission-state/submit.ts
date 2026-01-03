/**
 * Code Map: Permission Decision Submission
 * - Provides sendPermissionDecision function for submitting permission responses
 * 
 * CID Index:
 * CID:submit-001 -> sendPermissionDecision function
 * 
 * Quick lookup: grep -n "CID:submit-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/permission-state/submit.ts
 */

import type { RuntimeIpcService } from '../../runtime-ipc.service'
import type { PermissionDecision, PermissionRequestEvent } from '../../models/ui.models'

/**
 * CID:submit-001 - sendPermissionDecision Function
 * Purpose: Sends permission decision responses via IPC or ActaAPI based on request type
 * Uses: RuntimeIpcService, PermissionRequestEvent, PermissionDecision types
 * Used by: PermissionStateService for handling user permission decisions
 */
export async function sendPermissionDecision(opts: {
  runtimeIpc: RuntimeIpcService
  profileId: string
  request: PermissionRequestEvent
  decision: PermissionDecision
  remember: boolean
}): Promise<void> {
  const request = opts.request

  try {
    if (request.correlationId && request.replyTo) {
      const decisionType = opts.decision === 'deny' ? 'deny' : 'allow'
      opts.runtimeIpc.sendPermissionResponse(
        {
          requestId: request.requestId ?? request.id,
          decision: decisionType,
          remember: opts.remember,
        },
        {
          profileId: opts.profileId,
          correlationId: request.correlationId,
          replyTo: request.replyTo,
        },
      )
    } else {
      await window.ActaAPI?.respondToPermission({
        requestId: request.id,
        decision: opts.decision,
        remember: opts.remember,
      })
    }
  } catch {
    // ignore (UI scaffold only)
  }
}
