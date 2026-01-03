/*
 * Code Map: Shared HTTP Client for LLM Adapters
 * - LLMHttpClientOptions/LLMHttpRequestOptions: configure timeouts and retry policy
 * - LLMHttpClient: requestJson() helper with timeout, retries, cancellation, and error mapping
 * - createLLMHttpClient: convenience factory
 *
 * CID Index:
 * CID:llm-http-client-001 -> LLMHttpClientOptions
 * CID:llm-http-client-002 -> LLMHttpRequestOptions
 * CID:llm-http-client-003 -> LLMHttpClient
 * CID:llm-http-client-004 -> createLLMHttpClient
 *
 * Quick lookup: rg -n "CID:llm-http-client-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/http/client.ts
 */

import { toLLMError } from '../errors'
import { mergeAbortSignals } from './abort'
import { mapFetchError, mapHttpStatusToLLMError, safeReadBodySnippet } from './error-mapping'
import { sleepWithBackoff } from './retry'

// CID:llm-http-client-001 - LLMHttpClientOptions
// Purpose: Configure shared defaults for all adapter HTTP calls
// Uses: (none)
// Used by: createLLMHttpClient(), LLMHttpClient constructor callers
export interface LLMHttpClientOptions {
  timeoutMs?: number
  retries?: number
  retryBaseDelayMs?: number
  retryMaxDelayMs?: number
}

// CID:llm-http-client-002 - LLMHttpRequestOptions
// Purpose: Configure per-request overrides (headers, timeout, retries, cancellation)
// Uses: AbortSignal
// Used by: LLMHttpClient.requestJson()
export interface LLMHttpRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  retries?: number
  signal?: AbortSignal
  provider?: string
  requestId?: string
}

// CID:llm-http-client-003 - LLMHttpClient
// Purpose: Centralize timeout, retry, cancellation, and error normalization for adapters
// Uses: fetch, AbortController, mapping helpers
// Used by: Ollama/LM Studio/OpenAI/etc adapters (Phase-1)
export class LLMHttpClient {
  private timeoutMs: number
  private retries: number
  private retryBaseDelayMs: number
  private retryMaxDelayMs: number

  constructor(options?: LLMHttpClientOptions) {
    this.timeoutMs = options?.timeoutMs ?? 30_000
    const isTestEnv =
      typeof process !== 'undefined' &&
      typeof process.env === 'object' &&
      (typeof process.env.JEST_WORKER_ID === 'string' || process.env.NODE_ENV === 'test')
    this.retries = options?.retries ?? (isTestEnv ? 0 : 2)
    this.retryBaseDelayMs = options?.retryBaseDelayMs ?? 250
    this.retryMaxDelayMs = options?.retryMaxDelayMs ?? 2_000
  }

  async requestJson<T>(url: string, options?: LLMHttpRequestOptions): Promise<T> {
    const method = options?.method ?? 'POST'
    const retries = options?.retries ?? this.retries
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs

    const inputHeaders = options?.headers ?? {}
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(inputHeaders)) {
      if (k.toLowerCase() === 'content-type') continue
      headers[k] = v
    }
    headers['content-type'] = 'application/json'

    let attempt = 0
    while (true) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method,
          headers,
          body: options?.body,
          signal: options?.signal,
          timeoutMs,
        })

        if (!response.ok) {
          const snippet = await safeReadBodySnippet(response)
          const mapped = mapHttpStatusToLLMError({
            status: response.status,
            statusText: response.statusText,
            provider: options?.provider,
            requestId: options?.requestId,
            url,
            method,
            responseBodySnippet: snippet,
          })

          if (mapped.retryable && attempt < retries && !(options?.signal?.aborted ?? false)) {
            await sleepWithBackoff(attempt, this.retryBaseDelayMs, this.retryMaxDelayMs, options?.signal)
            attempt++
            continue
          }

          throw mapped
        }

        const text =
          typeof (response as any).text === 'function'
            ? await response.text()
            : typeof (response as any).json === 'function'
              ? JSON.stringify(await (response as any).json())
              : ''
        try {
          return JSON.parse(text) as T
        } catch (err) {
          throw toLLMError(err, {
            code: 'http.invalid_json',
            message: 'LLM provider returned an invalid JSON response',
            provider: options?.provider,
            requestId: options?.requestId,
            debug: {
              url,
              method,
              statusText: response.statusText,
              responseBodySnippet: text.slice(0, 2000),
            },
          })
        }
      } catch (err) {
        const mapped = mapFetchError(err, {
          provider: options?.provider,
          requestId: options?.requestId,
          url,
          method,
        })

        if (mapped.retryable && attempt < retries && !(options?.signal?.aborted ?? false)) {
          await sleepWithBackoff(attempt, this.retryBaseDelayMs, this.retryMaxDelayMs, options?.signal)
          attempt++
          continue
        }

        throw mapped
      }
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: {
      method: string
      headers: Record<string, string>
      body?: string
      signal?: AbortSignal
      timeoutMs: number
    },
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

    const signal = mergeAbortSignals(options.signal, controller.signal)

    try {
      return await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}

// CID:llm-http-client-004 - createLLMHttpClient
// Purpose: Convenience factory to keep adapter code terse
// Uses: LLMHttpClient
// Used by: adapters
export function createLLMHttpClient(options?: LLMHttpClientOptions): LLMHttpClient {
  return new LLMHttpClient(options)
}
