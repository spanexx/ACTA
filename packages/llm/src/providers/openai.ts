/*
 * Code Map: OpenAI Adapter (Cloud HTTP)
 * - OpenAIAdapter: LLMAdapter implementation backed by OpenAI Chat Completions API
 * - healthCheck/listModels: connectivity + auth check via /v1/models
 * - generate: non-streaming chat completion via /v1/chat/completions
 *
 * CID Index:
 * CID:llm-openai-001 -> OpenAIAdapterConfig
 * CID:llm-openai-002 -> OpenAIHealthCheckResult
 * CID:llm-openai-003 -> OpenAIAdapter class
 * CID:llm-openai-004 -> listModels() + caching
 * CID:llm-openai-005 -> healthCheck()
 * CID:llm-openai-006 -> supports() + assertModelAvailable()
 * CID:llm-openai-007 -> generate()
 *
 * Quick lookup: rg -n "CID:llm-openai-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/providers/openai.ts
 */

import { type LLMAdapter, type LLMRequest, type LLMResponse } from '../types'
import { type LLMError, toLLMError } from '../errors'
import { LLMHttpClient, createLLMHttpClient } from '../http/client'

// CID:llm-openai-001 - OpenAIAdapterConfig
// Purpose: Configure OpenAI cloud base URL, model, and API key
// Uses: (none)
// Used by: OpenAIAdapter constructor callers
export interface OpenAIAdapterConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
}

// CID:llm-openai-002 - OpenAIHealthCheckResult
// Purpose: Setup-wizard-friendly health check result (models list if reachable/authenticated)
// Uses: LLMError
// Used by: runtime/UI setup flows (Phase-1)
export type OpenAIHealthCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; error: LLMError }

// CID:llm-openai-003 - OpenAIAdapter
// Purpose: LLMAdapter implementation for OpenAI cloud via HTTP
// Uses: LLMHttpClient, /v1/models, /v1/chat/completions
// Used by: LLMRouter (once wired by M10-L6+)
export class OpenAIAdapter implements LLMAdapter {
  id = 'openai'
  label = 'OpenAI'

  private baseUrl: string
  private defaultModel?: string
  private apiKey: string
  private client: LLMHttpClient

  private modelCache?: { models: string[]; fetchedAt: number }

  constructor(config: OpenAIAdapterConfig, deps?: { client?: LLMHttpClient }) {
    const defaultBase = 'https://api.openai.com'
    const inputBase = (config.baseUrl ?? defaultBase).trim()
    const looksLikeOpenAI = /api\.openai\.com/.test(inputBase) || /openai\.com/.test(inputBase) || /azure\.com/.test(inputBase)
    if (config.baseUrl && !looksLikeOpenAI) {
      console.warn('[OpenAIAdapter] Ignoring unexpected baseUrl override; falling back to default', {
        providedBaseUrl: inputBase,
        defaultBaseUrl: defaultBase,
      })
      this.baseUrl = defaultBase
    } else {
      this.baseUrl = inputBase
    }
    this.defaultModel = config.model
    this.apiKey = (config.apiKey ?? '').trim()
    this.client = deps?.client ?? createLLMHttpClient({ timeoutMs: config.timeoutMs ?? 60_000 })

    if (!this.apiKey.length) {
      throw toLLMError(new Error('Missing OpenAI API key'), {
        code: 'llm.misconfigured',
        message: 'Missing OpenAI API key',
        provider: this.id,
        retryable: false,
      })
    }
  }

  private authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.apiKey}` }
  }

  // CID:llm-openai-004 - listModels
  // Purpose: List model ids available to the API key via /v1/models (cached)
  // Uses: LLMHttpClient.requestJson(), auth headers
  // Used by: supports(), healthCheck(), assertModelAvailable()
  async listModels(opts?: { bypassCache?: boolean }): Promise<string[]> {
    const ttlMs = 60_000
    if (!opts?.bypassCache && this.modelCache && Date.now() - this.modelCache.fetchedAt < ttlMs) {
      return this.modelCache.models
    }

    const url = new URL('/v1/models', this.baseUrl).toString()
    const json = await this.client.requestJson<any>(url, {
      method: 'GET',
      headers: this.authHeaders(),
      provider: this.id,
    })

    const models = Array.isArray(json?.data)
      ? json.data.map((m: any) => m?.id).filter((id: any) => typeof id === 'string')
      : []

    this.modelCache = { models, fetchedAt: Date.now() }
    return models
  }

  // CID:llm-openai-005 - healthCheck
  // Purpose: Verify connectivity and auth by calling /v1/models
  // Uses: listModels(), toLLMError()
  // Used by: setup wizard / runtime config validation
  async healthCheck(): Promise<OpenAIHealthCheckResult> {
    try {
      const models = await this.listModels({ bypassCache: true })
      return { ok: true, models }
    } catch (err) {
      return {
        ok: false,
        error: toLLMError(err, {
          message: 'Failed to connect to OpenAI',
          provider: this.id,
        }),
      }
    }
  }

  // CID:llm-openai-006 - supports + assertModelAvailable
  // Purpose: Validate configured model exists for the API key
  // Uses: listModels(), toLLMError()
  // Used by: router selection and generate()
  async supports(model?: string): Promise<boolean> {
    if (!model) return true
    const models = await this.listModels()
    return models.includes(model)
  }

  private async assertModelAvailable(model: string): Promise<void> {
    const ok = await this.supports(model)
    if (!ok) {
      throw toLLMError(new Error(`OpenAI model '${model}' not found`), {
        code: 'llm.model_not_found',
        message: `OpenAI model '${model}' not found`,
        provider: this.id,
        retryable: false,
      })
    }
  }

  // CID:llm-openai-007 - generate
  // Purpose: Perform a non-streaming chat completion via /v1/chat/completions
  // Uses: LLMHttpClient, OpenAI request/response shapes, assertModelAvailable
  // Used by: Planner and any LLM-driven features
  async generate(request: LLMRequest, options?: { model?: string }): Promise<LLMResponse> {
    const model = (options?.model ?? this.defaultModel ?? '').trim()
    if (!model.length) {
      throw toLLMError(new Error('No OpenAI model configured'), {
        code: 'llm.misconfigured',
        message: 'No OpenAI model configured',
        provider: this.id,
        retryable: false,
      })
    }

    await this.assertModelAvailable(model)

    const url = new URL('/v1/chat/completions', this.baseUrl).toString()

    const messages: Array<{ role: 'system' | 'user'; content: string }> = []
    if (typeof request.system === 'string' && request.system.trim().length) {
      messages.push({ role: 'system', content: request.system })
    }
    messages.push({ role: 'user', content: request.prompt })

    const body: any = {
      model,
      messages,
      stream: false,
    }

    if (typeof request.temperature === 'number') {
      body.temperature = request.temperature
    }
    if (typeof request.maxTokens === 'number') {
      body.max_tokens = request.maxTokens
    }

    const json = await this.client.requestJson<any>(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
      provider: this.id,
      requestId: request.metadata?.requestId,
    })

    const text =
      typeof json?.choices?.[0]?.message?.content === 'string' ? (json.choices[0].message.content as string) : ''

    if (!text.length) {
      throw toLLMError(new Error('OpenAI returned an empty response'), {
        code: 'llm.unknown',
        message: 'OpenAI returned an empty response',
        provider: this.id,
      })
    }

    const promptTokens = typeof json?.usage?.prompt_tokens === 'number' ? json.usage.prompt_tokens : undefined
    const completionTokens = typeof json?.usage?.completion_tokens === 'number' ? json.usage.completion_tokens : undefined

    return {
      text,
      model: typeof json?.model === 'string' ? json.model : model,
      tokens:
        typeof promptTokens === 'number' && typeof completionTokens === 'number'
          ? { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens }
          : undefined,
      raw: {
        provider: 'openai',
        cloud: true,
        response: json,
      },
    }
  }
}
