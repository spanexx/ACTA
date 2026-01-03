/*
 * Code Map: Tool Output Status Presentation
 * - statusIcon(): Maps status to an icon string.
 * - statusLabel(): Maps status to a human label.
 *
 * CID Index:
 * CID:tool-outputs-status-001 -> statusIcon
 * CID:tool-outputs-status-002 -> statusLabel
 *
 * Lookup: rg -n "CID:tool-outputs-status-" apps/ui/src/app/state/tool-outputs-state/status.ts
 */

import type { ToolOutputStatus } from '../../models/ui.models'

// CID:tool-outputs-status-001 - Status Icon
// Purpose: Returns a display icon for a tool output status.
// Uses: ToolOutputStatus
// Used by: ToolOutputsStateService.statusIcon(); tool panel UI
export function statusIcon(status: ToolOutputStatus): string {
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

// CID:tool-outputs-status-002 - Status Label
// Purpose: Returns a display label for a tool output status.
// Uses: ToolOutputStatus
// Used by: ToolOutputsStateService.statusLabel(); tool panel UI
export function statusLabel(status: ToolOutputStatus): string {
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
