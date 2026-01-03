/*
 * Code Map: HTTP Error Mapping
 * - mapHttpStatusToLLMError: normalize non-2xx HTTP responses
 * - mapFetchError: normalize network / timeout / abort errors
 * - safeReadBodySnippet: best-effort response snippet for debug
 *
 * CID Index:
 * CID:llm-http-errors-001 -> mapHttpStatusToLLMError
 * CID:llm-http-errors-002 -> mapFetchError
 * CID:llm-http-errors-003 -> safeReadBodySnippet
 *
 * Quick lookup: rg -n "CID:llm-http-errors-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/http/error-mapping.ts
 */

import { isLLMError, toLLMError, type LLMError } from '../errors'

export function sanitizeUrlForLogs(input: string): string {
  try {
    const u = new URL(input)
    const redactKeys = new Set([
      'key',
      'api_key',
      'apikey',
      'apiKey',
      'access_token',
      'token',
      'auth',
      'authorization',
    ])

    for (const k of Array.from(u.searchParams.keys())) {
      if (redactKeys.has(k)) {
        u.searchParams.set(k, 'REDACTED')
      }
    }

    return u.toString()
  } catch {
    return input
  }
}

// CID:llm-http-errors-001 - mapHttpStatusToLLMError
// Purpose: Map HTTP status codes into a stable LLMError taxonomy
// Uses: LLMError types
// Used by: LLMHttpClient when response.ok is false
export function mapHttpStatusToLLMError(opts: {
  status: number
  statusText?: string
  provider?: string
  requestId?: string
  url: string
  method: string
  responseBodySnippet?: string
}): LLMError {
  const base: Omit<LLMError, 'code' | 'message'> = {
    provider: opts.provider,
    status: opts.status,
    requestId: opts.requestId,
    debug: {
      url: sanitizeUrlForLogs(opts.url),
      method: opts.method,
      statusText: opts.statusText,
      responseBodySnippet: opts.responseBodySnippet,
    },
  }

  if (opts.status === 400) {
    return { code: 'http.bad_request', message: 'LLM provider rejected the request', retryable: false, ...base }
  }
  if (opts.status === 401) {
    return { code: 'http.unauthorized', message: 'LLM provider authorization failed', retryable: false, ...base }
  }
  if (opts.status === 403) {
    return { code: 'http.forbidden', message: 'LLM provider request was forbidden', retryable: false, ...base }
  }
  if (opts.status === 404) {
    return { code: 'http.not_found', message: 'LLM provider endpoint was not found', retryable: false, ...base }
  }
  if (opts.status === 429) {
    return { code: 'http.rate_limited', message: 'LLM provider rate limited the request', retryable: true, ...base }
  }
  if (opts.status >= 500 && opts.status <= 599) {
    return { code: 'http.server_error', message: 'LLM provider is unavailable', retryable: true, ...base }
  }

  return {
    code: 'http.bad_status',
    message: 'LLM provider returned an unexpected response',
    retryable: opts.status >= 408 && opts.status <= 499,
    ...base,
  }
}

// CID:llm-http-errors-002 - mapFetchError
// Purpose: Map fetch exceptions (abort/timeout/network) into LLMError
// Uses: isLLMError/toLLMError
// Used by: LLMHttpClient request loop catch handler
export function mapFetchError(
  err: unknown,
  opts: { provider?: string; requestId?: string; url: string; method: string },
): LLMError {
  if (isLLMError(err)) {
    return err
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    return {
      code: 'llm.cancelled',
      message: 'LLM request was cancelled',
      retryable: false,
      provider: opts.provider,
      requestId: opts.requestId,
      debug: { url: sanitizeUrlForLogs(opts.url), method: opts.method, cause: err },
    }
  }

  const message =
    typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string'
      ? (err as any).message
      : 'LLM request failed'

  const isTimeout = /timeout/i.test(message) || /etimedout/i.test(message) || /timed out/i.test(message)

  return toLLMError(err, {
    code: isTimeout ? 'http.timeout' : 'http.connection_failed',
    message: isTimeout ? 'LLM provider request timed out' : 'Failed to connect to LLM provider',
    retryable: true,
    provider: opts.provider,
    requestId: opts.requestId,
    debug: { url: sanitizeUrlForLogs(opts.url), method: opts.method },
  })
}

// CID:llm-http-errors-003 - safeReadBodySnippet
// Purpose: Capture a short response body snippet for debug (best-effort)
// Uses: Response.text()
// Used by: LLMHttpClient error mapping for non-ok responses
export async function safeReadBodySnippet(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text()
    return text.slice(0, 2000)
  } catch {
    return undefined
  }
}
