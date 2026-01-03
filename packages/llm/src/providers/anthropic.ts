/*
 * Code Map: Anthropic Adapter (Cloud HTTP)
 * - AnthropicAdapter: LLMAdapter implementation backed by Anthropic Messages API
 * - healthCheck/listModels: connectivity + auth check via /v1/models (best-effort)
 * - generate: non-streaming completion via /v1/messages
 *
 * CID Index:
 * CID:llm-anthropic-001 -> AnthropicAdapterConfig
 * CID:llm-anthropic-002 -> AnthropicHealthCheckResult
 * CID:llm-anthropic-003 -> AnthropicAdapter class
 * CID:llm-anthropic-004 -> listModels() + caching
 * CID:llm-anthropic-005 -> healthCheck()
 * CID:llm-anthropic-006 -> supports() + assertModelAvailable()
 * CID:llm-anthropic-007 -> generate()
 *
 * Quick lookup: rg -n "CID:llm-anthropic-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/providers/anthropic.ts
 */

import { type LLMAdapter, type LLMRequest, type LLMResponse } from '../types'
import { type LLMError, toLLMError } from '../errors'
import { LLMHttpClient, createLLMHttpClient } from '../http/client'

// CID:llm-anthropic-001 - AnthropicAdapterConfig
// Purpose: Configure Anthropic cloud base URL, model, and API key
// Uses: (none)
// Used by: AnthropicAdapter constructor callers
export interface AnthropicAdapterConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
  anthropicVersion?: string
}

// CID:llm-anthropic-002 - AnthropicHealthCheckResult
// Purpose: Setup-wizard-friendly health check result
// Uses: LLMError
// Used by: runtime/UI setup flows (Phase-1)
export type AnthropicHealthCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; error: LLMError }

// CID:llm-anthropic-003 - AnthropicAdapter
// Purpose: LLMAdapter implementation for Anthropic cloud via HTTP
// Uses: LLMHttpClient, /v1/messages, /v1/models
// Used by: LLMRouter (once wired by M10-L6+)
export class AnthropicAdapter implements LLMAdapter {
  id = 'anthropic'
  label = 'Anthropic'

  private baseUrl: string
  private defaultModel?: string
  private apiKey: string
  private anthropicVersion: string
  private client: LLMHttpClient

  private modelCache?: { models: string[]; fetchedAt: number }

  constructor(config: AnthropicAdapterConfig, deps?: { client?: LLMHttpClient }) {
    const defaultBase = 'https://api.anthropic.com'
    const inputBase = (config.baseUrl ?? defaultBase).trim()
    const looksLikeAnthropic = /api\.anthropic\.com/.test(inputBase) || /anthropic\.com/.test(inputBase)
    if (config.baseUrl && !looksLikeAnthropic) {
      console.warn('[AnthropicAdapter] Ignoring unexpected baseUrl override; falling back to default', {
        providedBaseUrl: inputBase,
        defaultBaseUrl: defaultBase,
      })
      this.baseUrl = defaultBase
    } else {
      this.baseUrl = inputBase
    }
    this.defaultModel = config.model
    this.apiKey = (config.apiKey ?? '').trim()
    this.anthropicVersion = (config.anthropicVersion ?? '2023-06-01').trim()
    this.client = deps?.client ?? createLLMHttpClient({ timeoutMs: config.timeoutMs ?? 60_000 })

    if (!this.apiKey.length) {
      throw toLLMError(new Error('Missing Anthropic API key'), {
        code: 'llm.misconfigured',
        message: 'Missing Anthropic API key',
        provider: this.id,
        retryable: false,
      })
    }
  }

  private authHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': this.anthropicVersion,
    }
  }

  // CID:llm-anthropic-004 - listModels
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
      ? json.data
          .map((m: any) => (typeof m?.id === 'string' ? m.id : typeof m?.name === 'string' ? m.name : undefined))
          .filter((id: any) => typeof id === 'string')
      : []

    this.modelCache = { models, fetchedAt: Date.now() }
    return models
  }

  // CID:llm-anthropic-005 - healthCheck
  // Purpose: Verify connectivity and auth by calling /v1/models
  // Uses: listModels(), toLLMError()
  // Used by: setup wizard / runtime config validation
  async healthCheck(): Promise<AnthropicHealthCheckResult> {
    try {
      const models = await this.listModels({ bypassCache: true })
      return { ok: true, models }
    } catch (err) {
      return {
        ok: false,
        error: toLLMError(err, {
          message: 'Failed to connect to Anthropic',
          provider: this.id,
        }),
      }
    }
  }

  // CID:llm-anthropic-006 - supports + assertModelAvailable
  // Purpose: Validate configured model exists for the API key (best-effort)
  // Uses: listModels(), toLLMError()
  // Used by: router selection and generate()
  async supports(model?: string): Promise<boolean> {
    if (!model) return true

    try {
      const models = await this.listModels()
      if (!models.length) {
        return true
      }
      return models.includes(model)
    } catch {
      return true
    }
  }

  private async assertModelAvailable(model: string): Promise<void> {
    const ok = await this.supports(model)
    if (!ok) {
      throw toLLMError(new Error(`Anthropic model '${model}' not found`), {
        code: 'llm.model_not_found',
        message: `Anthropic model '${model}' not found`,
        provider: this.id,
        retryable: false,
      })
    }
  }

  // CID:llm-anthropic-007 - generate
  // Purpose: Perform a non-streaming completion via /v1/messages
  // Uses: LLMHttpClient, Anthropic request/response shapes, assertModelAvailable
  // Used by: Planner and any LLM-driven features
  async generate(request: LLMRequest, options?: { model?: string }): Promise<LLMResponse> {
    const model = (options?.model ?? this.defaultModel ?? '').trim()
    if (!model.length) {
      throw toLLMError(new Error('No Anthropic model configured'), {
        code: 'llm.misconfigured',
        message: 'No Anthropic model configured',
        provider: this.id,
        retryable: false,
      })
    }

    await this.assertModelAvailable(model)

    const url = new URL('/v1/messages', this.baseUrl).toString()

    const body: any = {
      model,
      max_tokens: typeof request.maxTokens === 'number' ? request.maxTokens : 1024,
      messages: [{ role: 'user', content: request.prompt }],
    }

    if (typeof request.system === 'string' && request.system.trim().length) {
      body.system = request.system
    }

    if (typeof request.temperature === 'number') {
      body.temperature = request.temperature
    }

    const json = await this.client.requestJson<any>(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
      provider: this.id,
      requestId: request.metadata?.requestId,
    })

    const parts: any[] = Array.isArray(json?.content) ? json.content : []
    const text = parts
      .map(p => (p && p.type === 'text' && typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('')

    if (!text.length) {
      throw toLLMError(new Error('Anthropic returned an empty response'), {
        code: 'llm.unknown',
        message: 'Anthropic returned an empty response',
        provider: this.id,
      })
    }

    const promptTokens = typeof json?.usage?.input_tokens === 'number' ? json.usage.input_tokens : undefined
    const completionTokens = typeof json?.usage?.output_tokens === 'number' ? json.usage.output_tokens : undefined

    return {
      text,
      model,
      tokens:
        typeof promptTokens === 'number' && typeof completionTokens === 'number'
          ? { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens }
          : undefined,
      raw: {
        provider: 'anthropic',
        cloud: true,
        response: json,
      },
    }
  }
}
