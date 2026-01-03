/*
 * Code Map: Tool Outputs State
 * - ToolOutputsStateService: Maintains tool output timeline and related UI helpers/filters.
 * - Handles permission request/decision tracking and task.step tool output upserts.
 *
 * CID Index:
 * CID:tool-outputs-state.service-001 -> ToolOutputsStateService (state container)
 * CID:tool-outputs-state.service-002 -> statusIcon/statusLabel
 * CID:tool-outputs-state.service-003 -> getVisible
 * CID:tool-outputs-state.service-004 -> clearCompleted
 * CID:tool-outputs-state.service-005 -> exportAll
 * CID:tool-outputs-state.service-006 -> toggleRaw
 * CID:tool-outputs-state.service-007 -> copyJson/copyToClipboard/formatJson
 * CID:tool-outputs-state.service-008 -> isToolRunActive
 * CID:tool-outputs-state.service-009 -> trackPermissionRequest
 * CID:tool-outputs-state.service-010 -> applyPermissionDecision
 * CID:tool-outputs-state.service-011 -> handleTaskStepMessage
 *
 * Lookup: rg -n "CID:tool-outputs-state.service-" apps/ui/src/app/state/tool-outputs-state.service.ts
 */

import { Injectable } from '@angular/core'
import type { ActaMessage } from '@acta/ipc'
import type {
  PermissionDecision,
  PermissionRequestEvent,
  ToolOutputEntry,
  ToolOutputFilter,
  ToolOutputStatus,
} from '../models/ui.models'
import { statusIcon, statusLabel } from './tool-outputs-state/status'
import {
  clearCompleted as clearCompletedList,
  getVisible as getVisibleList,
  isToolRunActive as isToolRunActiveList,
  toggleRaw as toggleRawList,
} from './tool-outputs-state/filters'
import { copyJson, copyToClipboard, formatJson } from './tool-outputs-state/json'
import { exportAll as exportAllOutputs } from './tool-outputs-state/export'
import {
  applyPermissionDecision as applyPermissionDecisionList,
  trackPermissionRequest as trackPermissionRequestList,
} from './tool-outputs-state/permissions'
import { upsertFromTaskStepMessage } from './tool-outputs-state/task-step'

// CID:tool-outputs-state.service-001 - Tool Outputs State Container
// Purpose: Stores tool output entries and exposes helper methods for filtering and interaction.
// Uses: tool-outputs-state helpers (filters/json/export/permissions/task-step/status)
// Used by: Tool panel component; PermissionStateService; RuntimeEventsService
@Injectable({ providedIn: 'root' })
export class ToolOutputsStateService {
  toolOutputs: ToolOutputEntry[] = []
  toolFilter: ToolOutputFilter = 'all'
  toolSearch = ''

  // CID:tool-outputs-state.service-002 - Status UI Helpers
  // Purpose: Maps output status to icon/label strings.
  // Uses: statusIcon(), statusLabel()
  // Used by: Tool output list UI
  statusIcon(status: ToolOutputStatus): string {
    return statusIcon(status)
  }

  statusLabel(status: ToolOutputStatus): string {
    return statusLabel(status)
  }

  // CID:tool-outputs-state.service-003 - Visible Outputs
  // Purpose: Returns visible tool outputs based on current filter/search.
  // Uses: getVisibleList()
  // Used by: Tool output list UI
  getVisible(): ToolOutputEntry[] {
    return getVisibleList({
      toolOutputs: this.toolOutputs,
      toolFilter: this.toolFilter,
      toolSearch: this.toolSearch,
    })
  }

  // CID:tool-outputs-state.service-004 - Clear Completed
  // Purpose: Removes completed entries from the timeline.
  // Uses: clearCompletedList()
  // Used by: Tool panel UI
  clearCompleted(): void {
    this.toolOutputs = clearCompletedList(this.toolOutputs)
  }

  // CID:tool-outputs-state.service-005 - Export All
  // Purpose: Exports all outputs in a user-friendly format.
  // Uses: exportAllOutputs(), formatJson(), copyToClipboard()
  // Used by: Tool panel UI
  exportAll(): void {
    exportAllOutputs({
      toolOutputs: this.toolOutputs,
      formatJson: this.formatJson.bind(this),
      copyToClipboard: this.copyToClipboard.bind(this),
    })
  }

  // CID:tool-outputs-state.service-006 - Toggle Raw View
  // Purpose: Toggles raw JSON view for a specific output entry.
  // Uses: toggleRawList()
  // Used by: Tool output list UI
  toggleRaw(id: string): void {
    this.toolOutputs = toggleRawList(this.toolOutputs, id)
  }

  // CID:tool-outputs-state.service-007 - JSON Copy/Format Helpers
  // Purpose: Exposes clipboard and formatting helpers to the UI.
  // Uses: copyJson(), copyToClipboard(), formatJson()
  // Used by: Tool panel UI
  copyJson(value: unknown): void {
    copyJson(value)
  }

  copyToClipboard(text: string): void {
    copyToClipboard(text)
  }

  formatJson(value: unknown): string {
    return formatJson(value)
  }

  // CID:tool-outputs-state.service-008 - Active Run Detection
  // Purpose: Detects whether a tool run is currently active based on tool output statuses.
  // Uses: isToolRunActiveList()
  // Used by: ProfilesActionsService (switch confirmation gating)
  isToolRunActive(): boolean {
    return isToolRunActiveList(this.toolOutputs)
  }

  // CID:tool-outputs-state.service-009 - Track Permission Request
  // Purpose: Inserts a permission request entry into the tool outputs timeline.
  // Uses: trackPermissionRequestList()
  // Used by: PermissionStateService
  trackPermissionRequest(req: PermissionRequestEvent, now: number): void {
    this.toolOutputs = trackPermissionRequestList(this.toolOutputs, req, now)
  }

  // CID:tool-outputs-state.service-010 - Apply Permission Decision
  // Purpose: Updates a tracked permission request entry with the user's decision.
  // Uses: applyPermissionDecisionList()
  // Used by: PermissionStateService
  applyPermissionDecision(request: PermissionRequestEvent, decision: PermissionDecision, remember: boolean): void {
    this.toolOutputs = applyPermissionDecisionList(this.toolOutputs, request, decision, remember)
  }

  // CID:tool-outputs-state.service-011 - Task Step Tool Output Upsert
  // Purpose: Upserts tool output entries from runtime task.step messages.
  // Uses: upsertFromTaskStepMessage()
  // Used by: RuntimeEventsService
  handleTaskStepMessage(msg: ActaMessage): void {
    this.toolOutputs = upsertFromTaskStepMessage(this.toolOutputs, msg, Date.now())
  }
}
