/*
 * Code Map: Tool Outputs Filtering
 * - getVisible(): Applies filter + search text to tool outputs list.
 * - clearCompleted(): Removes completed outputs.
 * - isToolRunActive(): Detects whether any output is running / waiting permission.
 * - toggleRaw(): Toggles expanded/raw view for a specific output.
 *
 * CID Index:
 * CID:tool-outputs-filters-001 -> getVisible
 * CID:tool-outputs-filters-002 -> clearCompleted
 * CID:tool-outputs-filters-003 -> isToolRunActive
 * CID:tool-outputs-filters-004 -> toggleRaw
 *
 * Lookup: rg -n "CID:tool-outputs-filters-" apps/ui/src/app/state/tool-outputs-state/filters.ts
 */

import type { ToolOutputEntry, ToolOutputFilter } from '../../models/ui.models'

// CID:tool-outputs-filters-001 - Get Visible Tool Outputs
// Purpose: Filters tool outputs by status bucket (all/active/completed/error) and search text.
// Uses: ToolOutputEntry fields (status/tool/scope/input/reason/preview/error/artifacts)
// Used by: ToolOutputsStateService.getVisible() (tool panel UI)
export function getVisible(opts: {
  toolOutputs: ToolOutputEntry[]
  toolFilter: ToolOutputFilter
  toolSearch: string
}): ToolOutputEntry[] {
  const search = opts.toolSearch.trim().toLowerCase()

  return opts.toolOutputs
    .filter(out => {
      if (opts.toolFilter === 'all') return true
      if (opts.toolFilter === 'active') {
        return out.status === 'running' || out.status === 'waiting_permission'
      }
      if (opts.toolFilter === 'completed') return out.status === 'completed'
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

// CID:tool-outputs-filters-002 - Clear Completed
// Purpose: Removes completed entries from the output list.
// Uses: ToolOutputEntry.status
// Used by: ToolOutputsStateService.clearCompleted() (tool panel UI)
export function clearCompleted(toolOutputs: ToolOutputEntry[]): ToolOutputEntry[] {
  return toolOutputs.filter(out => out.status !== 'completed')
}

// CID:tool-outputs-filters-003 - Detect Active Run
// Purpose: Returns true if any output is running or awaiting permission.
// Uses: ToolOutputEntry.status
// Used by: ToolOutputsStateService.isToolRunActive(); Profiles switching confirmation gating
export function isToolRunActive(toolOutputs: ToolOutputEntry[]): boolean {
  return toolOutputs.some(out => out.status === 'running' || out.status === 'waiting_permission')
}

// CID:tool-outputs-filters-004 - Toggle Raw/Expanded View
// Purpose: Toggles the `expanded` flag for one output entry.
// Uses: ToolOutputEntry.id/expanded
// Used by: ToolOutputsStateService.toggleRaw() (tool panel UI)
export function toggleRaw(toolOutputs: ToolOutputEntry[], id: string): ToolOutputEntry[] {
  return toolOutputs.map(out => {
    if (out.id !== id) return out
    return { ...out, expanded: !out.expanded }
  })
}
