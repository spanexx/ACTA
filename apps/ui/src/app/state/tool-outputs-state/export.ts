/*
 * Code Map: Tool Outputs Export
 * - exportAll(): Exports tool output entries as JSON (download when possible; clipboard fallback).
 *
 * CID Index:
 * CID:tool-outputs-export-001 -> exportAll
 *
 * Lookup: rg -n "CID:tool-outputs-export-" apps/ui/src/app/state/tool-outputs-state/export.ts
 */

import type { ToolOutputEntry } from '../../models/ui.models'

// CID:tool-outputs-export-001 - Export Tool Outputs
// Purpose: Serializes tool outputs (excluding UI-only fields) and exports as a downloadable JSON file.
// Uses: Blob, URL.createObjectURL(), document.createElement('a'), opts.formatJson(), opts.copyToClipboard()
// Used by: ToolOutputsStateService.exportAll() (invoked from tool panel UI)
export function exportAll(opts: {
  toolOutputs: ToolOutputEntry[]
  formatJson: (value: unknown) => string
  copyToClipboard: (text: string) => void
}): void {
  const json = opts.formatJson(opts.toolOutputs.map(({ expanded, ...rest }) => rest))

  try {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `acta-tool-outputs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    opts.copyToClipboard(json)
  }
}
