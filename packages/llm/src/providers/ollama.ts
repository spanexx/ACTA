/*
 * Code Map: Ollama Adapter (HTTP)
 * - OllamaAdapter: LLMAdapter implementation backed by Ollama HTTP API
 * - healthCheck/listModels: connectivity + model discovery via /api/tags
 * - generate: non-streaming completion via /api/generate
 *
 * CID Index:
 * CID:llm-ollama-001 -> OllamaAdapterConfig
 * CID:llm-ollama-002 -> OllamaHealthCheckResult
 * CID:llm-ollama-003 -> OllamaAdapter class
 * CID:llm-ollama-004 -> listModels() + caching
 * CID:llm-ollama-005 -> healthCheck()
 * CID:llm-ollama-006 -> supports() + assertModelAvailable()
 * CID:llm-ollama-007 -> generate()
 *
 * Quick lookup: rg -n "CID:llm-ollama-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/providers/ollama.ts
 */

import { type LLMAdapter, type LLMRequest, type LLMResponse } from '../types'
import { type LLMError, toLLMError } from '../errors'
import { LLMHttpClient, createLLMHttpClient } from '../http/client'

// CID:llm-ollama-001 - OllamaAdapterConfig
// Purpose: Configure base URL and default model for an Ollama adapter instance
// Uses: (none)
// Used by: OllamaAdapter constructor callers
export interface OllamaAdapterConfig {
  baseUrl?: string
  model?: string
  timeoutMs?: number
}

// CID:llm-ollama-002 - OllamaHealthCheckResult
// Purpose: Provide a setup-wizard-friendly health check result (models list if reachable)
// Uses: LLMError
// Used by: runtime/UI setup flows (Phase-1)
export type OllamaHealthCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; error: LLMError }

// CID:llm-ollama-003 - OllamaAdapter
// Purpose: LLMAdapter implementation for Ollama via HTTP
// Uses: LLMHttpClient, /api/tags, /api/generate
// Used by: LLMRouter (once wired by M10-L6+)
export class OllamaAdapter implements LLMAdapter {
  id = 'ollama'
  label = 'Ollama'

  private baseUrl: string
  private defaultModel?: string
  private client: LLMHttpClient

  private modelCache?: { models: string[]; fetchedAt: number }

  constructor(config?: OllamaAdapterConfig, deps?: { client?: LLMHttpClient }) {
    this.baseUrl = (config?.baseUrl ?? 'http://localhost:11434').trim()
    this.defaultModel = config?.model
    this.client = deps?.client ?? createLLMHttpClient({ timeoutMs: config?.timeoutMs })
  }

  // CID:llm-ollama-004 - listModels
  // Purpose: Discover available model names via /api/tags with small in-memory caching
  // Uses: LLMHttpClient.requestJson(), URL
  // Used by: supports(), healthCheck(), assertModelAvailable()
  async listModels(opts?: { bypassCache?: boolean }): Promise<string[]> {
    const ttlMs = 30_000
    if (!opts?.bypassCache && this.modelCache && Date.now() - this.modelCache.fetchedAt < ttlMs) {
      return this.modelCache.models
    }

    const tagsUrl = new URL('/api/tags', this.baseUrl).toString()
    const json = await this.client.requestJson<any>(tagsUrl, {
      method: 'GET',
      provider: this.id,
    })

    const models = Array.isArray(json?.models)
      ? json.models.map((m: any) => m?.name).filter((n: any) => typeof n === 'string')
      : []

    this.modelCache = { models, fetchedAt: Date.now() }
    return models
  }

  // CID:llm-ollama-005 - healthCheck
  // Purpose: Validate connectivity to Ollama and return discovered model names
  // Uses: listModels(), toLLMError()
  // Used by: setup wizard / runtime config validation
  async healthCheck(): Promise<OllamaHealthCheckResult> {
    try {
      const models = await this.listModels({ bypassCache: true })
      return { ok: true, models }
    } catch (err) {
      return {
        ok: false,
        error: toLLMError(err, {
          message: 'Failed to connect to Ollama',
          provider: this.id,
        }),
      }
    }
  }

  // CID:llm-ollama-006 - supports + assertModelAvailable
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
      throw toLLMError(new Error(`Ollama model '${model}' not found`), {
        code: 'llm.model_not_found',
        message: `Ollama model '${model}' not found`,
        provider: this.id,
        retryable: false,
      })
    }
  }

  // CID:llm-ollama-007 - generate
  // Purpose: Perform a non-streaming completion via /api/generate
  // Uses: LLMHttpClient, assertModelAvailable(), request shaping
  // Used by: Planner and any LLM-driven features
  async generate(request: LLMRequest, options?: { model?: string }): Promise<LLMResponse> {
    const model = (options?.model ?? this.defaultModel ?? '').trim()
    if (!model.length) {
      throw toLLMError(new Error('No Ollama model configured'), {
        code: 'llm.misconfigured',
        message: 'No Ollama model configured',
        provider: this.id,
        retryable: false,
      })
    }

    await this.assertModelAvailable(model)

    const generateUrl = new URL('/api/generate', this.baseUrl).toString()

    const ollamaOptions: Record<string, any> = {}
    if (typeof request.temperature === 'number') {
      ollamaOptions.temperature = request.temperature
    }
    if (typeof request.maxTokens === 'number') {
      ollamaOptions.num_predict = request.maxTokens
    }

    const body: any = {
      model,
      prompt: request.prompt,
      stream: false,
    }

    if (typeof request.system === 'string' && request.system.trim().length) {
      body.system = request.system
    }

    if (Object.keys(ollamaOptions).length) {
      body.options = ollamaOptions
    }

    const json = await this.client.requestJson<any>(generateUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      provider: this.id,
      requestId: request.metadata?.requestId,
    })

    const text = typeof json?.response === 'string' ? json.response : ''
    if (!text.length) {
      throw toLLMError(new Error('Ollama returned an empty response'), {
        code: 'llm.unknown',
        message: 'Ollama returned an empty response',
        provider: this.id,
      })
    }

    const promptTokens = typeof json?.prompt_eval_count === 'number' ? json.prompt_eval_count : undefined
    const completionTokens = typeof json?.eval_count === 'number' ? json.eval_count : undefined

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
