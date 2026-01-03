/*
 * Code Map: Utility Functions
 * - safeStringify: Safely convert any value to string
 * - clampString: Limit string length to maximum characters
 * - summarizeToolResult: Create summary of tool execution result
 * 
 * CID Index:
 * CID:utils-001 -> safeStringify
 * CID:utils-002 -> clampString
 * CID:utils-003 -> summarizeToolResult
 * 
 * Quick lookup: rg -n "CID:utils-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/utils.ts
 */

// CID:utils-001 - safeStringify
// Purpose: Safely convert any value to string, fallback to String() if JSON fails
// Uses: JSON.stringify for objects, String() as fallback
// Used by: summarizeToolResult for output serialization
function safeStringify(value: any): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

// CID:utils-002 - clampString
// Purpose: Limit string length to specified maximum characters
// Uses: String slice method for truncation
// Used by: Transcript persistence and tool result summarization
export function clampString(value: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (value.length <= maxChars) return value
  return value.slice(0, maxChars)
}

// CID:utils-003 - summarizeToolResult
// Purpose: Create structured summary of tool execution result with size limits
// Uses: safeStringify, clampString for data processing
// Used by: persistTranscriptOnResult for tool output storage
export function summarizeToolResult(result: any, maxChars: number): any {
  if (!result || typeof result !== 'object') return { success: false, error: 'invalid tool result' }

  const output = (result as any).output
  const error = (result as any).error
  const artifacts = Array.isArray((result as any).artifacts) ? (result as any).artifacts : undefined

  const out: any = {
    success: Boolean((result as any).success),
  }

  if (typeof error === 'string' && error.length) {
    out.error = clampString(error, maxChars)
  }

  if (output !== undefined) {
    out.output = clampString(safeStringify(output), maxChars)
  }

  if (artifacts && artifacts.length) {
    out.artifacts = artifacts.slice(0, 20)
  }

  return out
}
