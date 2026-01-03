/*
 * Code Map: Custom AI Adapter (User-configured HTTP endpoint)
 * - CustomAIAdapter: LLMAdapter implementation backed by a user-provided HTTP gateway
 * - healthCheck: GET /health against the configured base URL
 * - generate: POST /generate with a minimal, documented JSON contract
 *
 * CID Index:
 * CID:llm-custom-001 -> CustomAIAdapterConfig
 * CID:llm-custom-002 -> CustomAIHealthCheckResult
 * CID:llm-custom-003 -> CustomAIAdapter class
 * CID:llm-custom-004 -> healthCheck()
 * CID:llm-custom-005 -> generate()
 * CID:llm-custom-006 -> parseGeneratedText()
 *
 * Quick lookup: rg -n "CID:llm-custom-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/providers/custom.ts
 */

import { type LLMAdapter, type LLMRequest, type LLMResponse } from '../types'
import { type LLMError, toLLMError } from '../errors'
import { LLMHttpClient, createLLMHttpClient } from '../http/client'

// CID:llm-custom-001 - CustomAIAdapterConfig
// Purpose: Configure a user-provided HTTP gateway endpoint
// Uses: (none)
// Used by: CustomAIAdapter constructor callers
export interface CustomAIAdapterConfig {
  baseUrl: string
  model?: string
  headers?: Record<string, string>
  timeoutMs?: number
}

// CID:llm-custom-002 - CustomAIHealthCheckResult
// Purpose: Setup-wizard-friendly health check result
// Uses: LLMError
// Used by: runtime/UI setup flows (Phase-1)
export type CustomAIHealthCheckResult =
  | { ok: true; models?: string[] }
  | { ok: false; error: LLMError }

// CID:llm-custom-003 - CustomAIAdapter
// Purpose: LLMAdapter implementation for a user-configured HTTP endpoint
// Uses: LLMHttpClient, /health, /generate
// Used by: LLMRouter (once wired by M10-L6+)
export class CustomAIAdapter implements LLMAdapter {
  id = 'custom'
  label = 'Custom AI'

  private baseUrl: string
  private defaultModel?: string
  private headers: Record<string, string>
  private client: LLMHttpClient

  constructor(config: CustomAIAdapterConfig, deps?: { client?: LLMHttpClient }) {
    this.baseUrl = (config.baseUrl ?? '').trim()
    this.defaultModel = config.model
    this.headers = normalizeHeaders(config.headers ?? {})
    this.client = deps?.client ?? createLLMHttpClient({ timeoutMs: config.timeoutMs })

    if (!this.baseUrl.length) {
      throw toLLMError(new Error('Missing custom AI base URL'), {
        code: 'llm.misconfigured',
        message: 'Missing custom AI base URL',
        provider: this.id,
        retryable: false,
      })
    }
  }

  supports(model?: string): boolean {
    if (!model) return true
    if (!this.defaultModel) return true
    return model === this.defaultModel
  }

  // CID:llm-custom-004 - healthCheck
  // Purpose: Verify the custom endpoint is reachable (Phase-1 contract: GET /health)
  // Uses: fetch via LLMHttpClient internals + shared error mapping
  // Used by: setup wizard “test connection” (Phase-1)
  async healthCheck(): Promise<CustomAIHealthCheckResult> {
    try {
      if (isOpenAICompatibleUrl(this.baseUrl)) {
        try {
          const modelsUrl = resolveOpenAIModelsUrl(this.baseUrl)
          const json = await this.client.requestJson<any>(modelsUrl, {
            method: 'GET',
            headers: this.headers,
            provider: this.id,
          })

          const models = Array.isArray(json?.data)
            ? json.data.map((m: any) => m?.id).filter((id: any) => typeof id === 'string')
            : []

          return { ok: true, models }
        } catch {
          const url = resolveOpenAIChatCompletionsUrl(this.baseUrl)
          const model = (this.defaultModel ?? '').trim()
          await this.client.requestJson<any>(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
              ...(model.length ? { model } : {}),
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 1,
            }),
            provider: this.id,
          })
        }
      } else {
        const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`
        const url = new URL('health', base).toString()
        await this.client.requestJson<any>(url, {
          method: 'GET',
          headers: this.headers,
          provider: this.id,
        })
      }
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        error: toLLMError(err, {
          message: `Failed to connect to custom AI endpoint: ${String((err as any)?.message ?? err)}`,
          provider: this.id,
        }),
      }
    }
  }

  // CID:llm-custom-005 - generate
  // Purpose: Perform a non-streaming completion via POST /generate
  // Uses: LLMHttpClient, minimal JSON contract
  // Used by: Planner and any LLM-driven features
  async generate(request: LLMRequest, options?: { model?: string }): Promise<LLMResponse> {
    const model = (options?.model ?? this.defaultModel ?? '').trim()

    if (isOpenAICompatibleUrl(this.baseUrl)) {
      const url = resolveOpenAIChatCompletionsUrl(this.baseUrl)
      const messages: Array<{ role: 'system' | 'user'; content: string }> = []
      if (typeof request.system === 'string' && request.system.trim().length) {
        messages.push({ role: 'system', content: request.system })
      }
      messages.push({ role: 'user', content: request.prompt })

      const json = await this.client.requestJson<any>(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          ...(model.length ? { model } : {}),
          messages,
          ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
          ...(typeof request.maxTokens === 'number' ? { max_tokens: request.maxTokens } : {}),
        }),
        provider: this.id,
        requestId: request.metadata?.requestId,
      })

      const text = parseGeneratedText(json)
      if (!text.length) {
        throw toLLMError(new Error('Custom AI returned an empty response'), {
          code: 'llm.unknown',
          message: 'Custom AI returned an empty response',
          provider: this.id,
        })
      }

      const promptTokens =
        typeof json?.usage?.prompt === 'number'
          ? json.usage.prompt
          : typeof json?.usage?.prompt_tokens === 'number'
            ? json.usage.prompt_tokens
            : undefined

      const completionTokens =
        typeof json?.usage?.completion === 'number'
          ? json.usage.completion
          : typeof json?.usage?.completion_tokens === 'number'
            ? json.usage.completion_tokens
            : undefined

      return {
        text,
        model,
        tokens:
          typeof promptTokens === 'number' && typeof completionTokens === 'number'
            ? { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens }
            : undefined,
        raw: {
          provider: 'custom',
          response: json,
        },
      }
    }

    const url = new URL('/generate', this.baseUrl).toString()

    // [Milestone] Phase-1 minimal contract
    // inputs: { model?, prompt, system?, temperature?, maxTokens?, metadata? }
    // output: { text } OR common shapes { response } / OpenAI-like { choices[0].message.content }
    const body: any = {
      prompt: request.prompt,
      metadata: request.metadata,
    }

    if (model.length) body.model = model
    if (typeof request.system === 'string' && request.system.trim().length) body.system = request.system
    if (typeof request.temperature === 'number') body.temperature = request.temperature
    if (typeof request.maxTokens === 'number') body.maxTokens = request.maxTokens

    const json = await this.client.requestJson<any>(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
      provider: this.id,
      requestId: request.metadata?.requestId,
    })

    const text = parseGeneratedText(json)
    if (!text.length) {
      throw toLLMError(new Error('Custom AI returned an empty response'), {
        code: 'llm.unknown',
        message: 'Custom AI returned an empty response',
        provider: this.id,
      })
    }

    const promptTokens =
      typeof json?.usage?.prompt === 'number'
        ? json.usage.prompt
        : typeof json?.usage?.prompt_tokens === 'number'
          ? json.usage.prompt_tokens
          : undefined

    const completionTokens =
      typeof json?.usage?.completion === 'number'
        ? json.usage.completion
        : typeof json?.usage?.completion_tokens === 'number'
          ? json.usage.completion_tokens
          : undefined

    return {
      text,
      model,
      tokens:
        typeof promptTokens === 'number' && typeof completionTokens === 'number'
          ? { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens }
          : undefined,
      raw: {
        provider: 'custom',
        response: json,
      },
    }
  }
}

// CID:llm-custom-006 - parseGeneratedText
// Purpose: Extract a text completion from a variety of common provider response shapes
// Uses: (none)
// Used by: CustomAIAdapter.generate()
function parseGeneratedText(json: any): string {
  if (!json) return ''

  if (typeof json.text === 'string') return json.text
  if (typeof json.response === 'string') return json.response

  const openAiText =
    typeof json?.choices?.[0]?.message?.content === 'string' ? (json.choices[0].message.content as string) : ''
  if (openAiText) return openAiText

  const directChoiceText = typeof json?.choices?.[0]?.text === 'string' ? (json.choices[0].text as string) : ''
  if (directChoiceText) return directChoiceText

  return ''
}

function isOpenAICompatibleUrl(url: string): boolean {
  const s = (url ?? '').trim().toLowerCase()
  if (!s.length) return false

  if (s.includes('router.huggingface.co')) return true

  return s.includes('/v1/') || s.endsWith('/v1') || s.endsWith('/chat/completions') || s.endsWith('/completions')
}

function resolveOpenAIChatCompletionsUrl(baseUrl: string): string {
  const trimmed = (baseUrl ?? '').trim()
  if (!trimmed.length) return trimmed
  const lower = trimmed.toLowerCase()

  try {
    const u = new URL(trimmed)
    if (u.hostname.toLowerCase() === 'router.huggingface.co') {
      const p = u.pathname.replace(/\/+$/, '')

      if (p === '' || p === '/') {
        return new URL('v1/chat/completions', u.origin + '/').toString()
      }

      if (p === '/v1') {
        return new URL('chat/completions', u.origin + '/v1/').toString()
      }

      if (p.endsWith('/v1')) {
        return new URL('chat/completions', u.origin + p + '/').toString()
      }

      if (!p.includes('/v1')) {
        return new URL('v1/chat/completions', u.origin + p + '/').toString()
      }
    }
  } catch {
    // ignore
  }

  if (lower.endsWith('/chat/completions') || lower.endsWith('/completions')) return trimmed

  if (lower.endsWith('/v1')) {
    return new URL('chat/completions', trimmed + '/').toString()
  }

  if (lower.endsWith('/v1/')) {
    return new URL('chat/completions', trimmed).toString()
  }

  if (lower.includes('/v1/')) {
    const u = new URL(trimmed)
    const idx = u.pathname.toLowerCase().indexOf('/v1/')
    const basePath = u.pathname.slice(0, idx + 4)
    const root = new URL(u.origin)
    root.pathname = basePath.endsWith('/') ? basePath : basePath + '/'
    return new URL('chat/completions', root.toString()).toString()
  }

  return new URL('chat/completions', trimmed + (trimmed.endsWith('/') ? '' : '/')).toString()
}

function resolveOpenAIModelsUrl(baseUrl: string): string {
  const trimmed = (baseUrl ?? '').trim()
  if (!trimmed.length) return trimmed

  try {
    const u = new URL(trimmed)
    const p = u.pathname.replace(/\/+$/, '')
    if (p.endsWith('/chat/completions')) {
      u.pathname = p.slice(0, -'/chat/completions'.length) + '/models'
      return u.toString()
    }
    if (p.endsWith('/completions')) {
      u.pathname = p.slice(0, -'/completions'.length) + '/models'
      return u.toString()
    }
  } catch {
    // ignore
  }

  const lower = trimmed.toLowerCase()
  if (lower.endsWith('/v1')) {
    return new URL('models', trimmed + '/').toString()
  }
  if (lower.endsWith('/v1/')) {
    return new URL('models', trimmed).toString()
  }
  if (lower.includes('/v1/')) {
    const u = new URL(trimmed)
    const idx = u.pathname.toLowerCase().indexOf('/v1/')
    const basePath = u.pathname.slice(0, idx + 4)
    const root = new URL(u.origin)
    root.pathname = basePath.endsWith('/') ? basePath : basePath + '/'
    return new URL('models', root.toString()).toString()
  }

  return new URL('v1/models', trimmed + (trimmed.endsWith('/') ? '' : '/')).toString()
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...headers }
  const authKey = Object.keys(out).find(k => k.toLowerCase() === 'authorization')
  if (authKey) {
    const val = String(out[authKey] ?? '').trim()
    if (val.startsWith('hf_')) out[authKey] = `Bearer ${val}`
  }
  return out
}
