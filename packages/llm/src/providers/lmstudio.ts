/*
 * Code Map: LM Studio Adapter (OpenAI-compatible local HTTP)
 * - LMStudioAdapter: LLMAdapter implementation backed by OpenAI-compatible server (LM Studio)
 * - healthCheck/listModels: connectivity + model discovery via /v1/models
 * - generate: non-streaming chat completion via /v1/chat/completions
 *
 * CID Index:
 * CID:llm-lmstudio-001 -> LMStudioAdapterConfig
 * CID:llm-lmstudio-002 -> LMStudioHealthCheckResult
 * CID:llm-lmstudio-003 -> LMStudioAdapter class
 * CID:llm-lmstudio-004 -> listModels() + caching
 * CID:llm-lmstudio-005 -> healthCheck()
 * CID:llm-lmstudio-006 -> supports() + assertModelAvailable()
 * CID:llm-lmstudio-007 -> generate()
 *
 * Quick lookup: rg -n "CID:llm-lmstudio-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/providers/lmstudio.ts
 */

import { type LLMAdapter, type LLMRequest, type LLMResponse } from '../types'
import { type LLMError, toLLMError } from '../errors'
import { LLMHttpClient, createLLMHttpClient } from '../http/client'

// CID:llm-lmstudio-001 - LMStudioAdapterConfig
// Purpose: Configure base URL and default model for an OpenAI-compatible local server (LM Studio)
// Uses: (none)
// Used by: LMStudioAdapter constructor callers
export interface LMStudioAdapterConfig {
  baseUrl?: string
  model?: string
  timeoutMs?: number
}

// CID:llm-lmstudio-002 - LMStudioHealthCheckResult
// Purpose: Provide a setup-wizard-friendly health check result (models list if reachable)
// Uses: LLMError
// Used by: runtime/UI setup flows (Phase-1)
export type LMStudioHealthCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; error: LLMError }

// CID:llm-lmstudio-003 - LMStudioAdapter
// Purpose: LLMAdapter for OpenAI-compatible local servers (LM Studio)
// Uses: LLMHttpClient, /v1/models, /v1/chat/completions
// Used by: LLMRouter (once wired by M10-L6+)
export class LMStudioAdapter implements LLMAdapter {
  id = 'lmstudio'
  label = 'LM Studio'

  private baseUrl: string
  private defaultModel?: string
  private client: LLMHttpClient

  private modelCache?: { models: string[]; fetchedAt: number }

  constructor(config?: LMStudioAdapterConfig, deps?: { client?: LLMHttpClient }) {
    this.baseUrl = (config?.baseUrl ?? 'http://localhost:1234').trim()
    this.defaultModel = config?.model
    this.client = deps?.client ?? createLLMHttpClient({ timeoutMs: config?.timeoutMs })
  }

  // CID:llm-lmstudio-004 - listModels
  // Purpose: Discover available model ids via /v1/models with small in-memory caching
  // Uses: LLMHttpClient.requestJson(), URL
  // Used by: supports(), healthCheck(), assertModelAvailable()
  async listModels(opts?: { bypassCache?: boolean }): Promise<string[]> {
    const ttlMs = 30_000
    if (!opts?.bypassCache && this.modelCache && Date.now() - this.modelCache.fetchedAt < ttlMs) {
      return this.modelCache.models
    }

    const modelsUrl = new URL('/v1/models', this.baseUrl).toString()
    const json = await this.client.requestJson<any>(modelsUrl, {
      method: 'GET',
      provider: this.id,
    })

    const models = Array.isArray(json?.data)
      ? json.data.map((m: any) => m?.id).filter((id: any) => typeof id === 'string')
      : []

    this.modelCache = { models, fetchedAt: Date.now() }
    return models
  }

  // CID:llm-lmstudio-005 - healthCheck
  // Purpose: Validate connectivity to LM Studio and return discovered model names
  // Uses: listModels(), toLLMError()
  // Used by: setup wizard / runtime config validation
  async healthCheck(): Promise<LMStudioHealthCheckResult> {
    try {
      const models = await this.listModels({ bypassCache: true })
      return { ok: true, models }
    } catch (err) {
      return {
        ok: false,
        error: toLLMError(err, {
          message: 'Failed to connect to LM Studio',
          provider: this.id,
        }),
      }
    }
  }

  // CID:llm-lmstudio-006 - supports + assertModelAvailable
  // Purpose: Provide fast capability checks and a clear error when a model is missing
  // Uses: listModels(), toLLMError()
  // Used by: LLMRouter selection and generate()
  async supports(model?: string): Promise<boolean> {
    if (!model) {
      return true
    }
    const models = await this.listModels()
    return models.includes(model)
  }

  private async assertModelAvailable(model: string): Promise<void> {
    const ok = await this.supports(model)
    if (!ok) {
      throw toLLMError(new Error(`LM Studio model '${model}' not found`), {
        code: 'llm.model_not_found',
        message: `LM Studio model '${model}' not found`,
        provider: this.id,
        retryable: false,
      })
    }
  }

  // CID:llm-lmstudio-007 - generate
  // Purpose: Perform a non-streaming chat completion via /v1/chat/completions
  // Uses: LLMHttpClient, assertModelAvailable(), OpenAI-compatible message shaping
  // Used by: Planner and any LLM-driven features
  async generate(request: LLMRequest, options?: { model?: string }): Promise<LLMResponse> {
    const model = (options?.model ?? this.defaultModel ?? '').trim()
    if (!model.length) {
      throw toLLMError(new Error('No LM Studio model configured'), {
        code: 'llm.misconfigured',
        message: 'No LM Studio model configured',
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
      body: JSON.stringify(body),
      provider: this.id,
      requestId: request.metadata?.requestId,
    })

    const text =
      typeof json?.choices?.[0]?.message?.content === 'string' ? (json.choices[0].message.content as string) : ''

    if (!text.length) {
      throw toLLMError(new Error('LM Studio returned an empty response'), {
        code: 'llm.unknown',
        message: 'LM Studio returned an empty response',
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
      raw: json,
    }
  }
}
