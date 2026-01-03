/*
 * Code Map: HTTP Abort Utilities
 * - mergeAbortSignals: combine multiple AbortSignals into one
 *
 * CID Index:
 * CID:llm-http-abort-001 -> mergeAbortSignals
 *
 * Quick lookup: rg -n "CID:llm-http-abort-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/http/abort.ts
 */

// CID:llm-http-abort-001 - mergeAbortSignals
// Purpose: Merge optional cancellation signals so both timeout + caller cancellation can abort
// Uses: AbortController
// Used by: LLMHttpClient fetch wrapper
export function mergeAbortSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) {
    return b
  }
  if (!b) {
    return a
  }
  if (a.aborted) {
    return a
  }
  if (b.aborted) {
    return b
  }

  const controller = new AbortController()
  const onAbort = () => controller.abort()

  a.addEventListener('abort', onAbort)
  b.addEventListener('abort', onAbort)

  return controller.signal
}
