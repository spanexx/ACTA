/*
 * Code Map: Tool Output Permission Tracking
 * - trackPermissionRequest(): Adds a waiting_permission entry for a new permission request.
 * - applyPermissionDecision(): Updates the tracked entry when a user decides.
 *
 * CID Index:
 * CID:tool-outputs-permissions-001 -> trackPermissionRequest
 * CID:tool-outputs-permissions-002 -> applyPermissionDecision
 *
 * Lookup: rg -n "CID:tool-outputs-permissions-" apps/ui/src/app/state/tool-outputs-state/permissions.ts
 */

import type { PermissionDecision, PermissionRequestEvent, ToolOutputEntry } from '../../models/ui.models'

// CID:tool-outputs-permissions-001 - Track Permission Request
// Purpose: Inserts a tool output entry representing a permission gate, avoiding duplicates.
// Uses: PermissionRequestEvent fields; ToolOutputEntry
// Used by: ToolOutputsStateService.trackPermissionRequest(); PermissionStateService.openWithRequest()
export function trackPermissionRequest(toolOutputs: ToolOutputEntry[], req: PermissionRequestEvent, now: number): ToolOutputEntry[] {
  const alreadyTracked = toolOutputs.some(out => out.id === req.id)
  if (alreadyTracked) return toolOutputs

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

  return [entry, ...toolOutputs]
}

export function applyPermissionDecision(
  toolOutputs: ToolOutputEntry[],
  request: PermissionRequestEvent,
  decision: PermissionDecision,
  remember: boolean,
): ToolOutputEntry[] {
  // CID:tool-outputs-permissions-002 - Apply Permission Decision
  // Purpose: Updates the tracked permission output entry with decision/remember and transitions status.
  // Uses: ToolOutputEntry.raw; decision/remember
  // Used by: ToolOutputsStateService.applyPermissionDecision(); PermissionStateService.submit()
  return toolOutputs.map(out => {
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
