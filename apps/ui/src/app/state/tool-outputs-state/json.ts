/*
 * Code Map: Tool Outputs JSON Helpers
 * - copyToClipboard(): Best-effort clipboard write.
 * - formatJson(): Safe JSON stringify with fallback.
 * - copyJson(): Convenience wrapper to format + copy.
 *
 * CID Index:
 * CID:tool-outputs-json-001 -> copyToClipboard
 * CID:tool-outputs-json-002 -> formatJson
 * CID:tool-outputs-json-003 -> copyJson
 *
 * Lookup: rg -n "CID:tool-outputs-json-" apps/ui/src/app/state/tool-outputs-state/json.ts
 */

// CID:tool-outputs-json-001 - Copy To Clipboard
// Purpose: Copies text to clipboard using the browser clipboard API (best-effort).
// Uses: navigator.clipboard.writeText
// Used by: ToolOutputsStateService.copyToClipboard(); exportAll fallback
export function copyToClipboard(text: string): void {
  void navigator.clipboard?.writeText(text)
}

// CID:tool-outputs-json-002 - Format JSON
// Purpose: Safely stringifies a value as pretty JSON with a fallback to String().
// Uses: JSON.stringify
// Used by: ToolOutputsStateService.formatJson(); exportAll
export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// CID:tool-outputs-json-003 - Copy JSON
// Purpose: Formats a value as JSON and copies it to clipboard.
// Uses: formatJson(), copyToClipboard()
// Used by: Tool panel UI (copy raw output)
export function copyJson(value: unknown): void {
  copyToClipboard(formatJson(value))
}
