/*
 * Code Map: HTTP Retry Utilities
 * - sleepWithBackoff: exponential backoff with small jitter and AbortSignal cancellation
 *
 * CID Index:
 * CID:llm-http-retry-001 -> sleepWithBackoff
 *
 * Quick lookup: rg -n "CID:llm-http-retry-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/http/retry.ts
 */

// CID:llm-http-retry-001 - sleepWithBackoff
// Purpose: Delay between retry attempts with cancellation support
// Uses: setTimeout, AbortSignal
// Used by: LLMHttpClient retry loop
export function sleepWithBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt))
  const jitter = Math.floor(Math.random() * 50)
  const delay = exp + jitter

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, delay)

    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const cleanup = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort)
  })
}
