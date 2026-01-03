/*
 * Code Map: LLM Error Taxonomy
 * - LLMErrorCode: stable codes for UI + logging
 * - LLMError: normalized error shape
 * - isLLMError/toLLMError: runtime guards + normalization
 *
 * CID Index:
 * CID:llm-errors-001 -> LLMErrorCode
 * CID:llm-errors-002 -> LLMError
 * CID:llm-errors-003 -> isLLMError
 * CID:llm-errors-004 -> toLLMError
 *
 * Quick lookup: rg -n "CID:llm-errors-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/errors.ts
 */

// CID:llm-errors-001 - LLMErrorCode
// Purpose: Enumerate normalized failure modes across providers
// Uses: (none)
// Used by: LLMHttpClient error mapping and adapter-level error handling
export type LLMErrorCode =
  | 'llm.cancelled'
  | 'llm.misconfigured'
  | 'llm.model_not_found'
  | 'http.timeout'
  | 'http.connection_failed'
  | 'http.rate_limited'
  | 'http.unauthorized'
  | 'http.forbidden'
  | 'http.not_found'
  | 'http.bad_request'
  | 'http.server_error'
  | 'http.bad_status'
  | 'http.invalid_json'
  | 'llm.unknown'

// CID:llm-errors-002 - LLMError
// Purpose: Provide a user-safe error structure with optional debug fields
// Uses: LLMErrorCode
// Used by: HTTP client, adapters, router callers
export interface LLMError {
  code: LLMErrorCode
  message: string
  provider?: string
  status?: number
  retryable?: boolean
  requestId?: string
  debug?: {
    url?: string
    method?: string
    statusText?: string
    responseBodySnippet?: string
    cause?: unknown
  }
}

// CID:llm-errors-003 - isLLMError
// Purpose: Narrow unknown error values into LLMError
// Uses: (none)
// Used by: toLLMError(), callers that want to treat normalized errors specially
export function isLLMError(err: unknown): err is LLMError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as any).code === 'string' &&
    'message' in err &&
    typeof (err as any).message === 'string'
  )
}

// CID:llm-errors-004 - toLLMError
// Purpose: Normalize unknown errors into a consistent LLMError shape
// Uses: isLLMError()
// Used by: HTTP layer and adapters
export function toLLMError(err: unknown, fallback?: Partial<LLMError>): LLMError {
  if (isLLMError(err)) {
    return err
  }

  const message =
    typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string'
      ? (err as any).message
      : 'LLM request failed'

  return {
    code: fallback?.code ?? 'llm.unknown',
    message: fallback?.message ?? message,
    provider: fallback?.provider,
    status: fallback?.status,
    retryable: fallback?.retryable,
    requestId: fallback?.requestId,
    debug: {
      ...fallback?.debug,
      cause: err,
    },
  }
}
