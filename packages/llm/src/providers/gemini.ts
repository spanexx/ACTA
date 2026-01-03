/*
 * Code Map: Gemini Adapter (Cloud HTTP)
 * - GeminiAdapter: LLMAdapter implementation backed by Google Gemini Generative Language API
 * - healthCheck/listModels: connectivity + key check via /models
 * - generate: non-streaming completion via /models/{model}:generateContent
 *
 * CID Index:
 * CID:llm-gemini-001 -> GeminiAdapterConfig
 * CID:llm-gemini-002 -> GeminiHealthCheckResult
 * CID:llm-gemini-003 -> GeminiAdapter class
 * CID:llm-gemini-004 -> listModels() + caching
 * CID:llm-gemini-005 -> healthCheck()
 * CID:llm-gemini-006 -> supports() + assertModelAvailable()
 * CID:llm-gemini-007 -> generate()
 *
 * Quick lookup: rg -n "CID:llm-gemini-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/providers/gemini.ts
 */

import { type LLMAdapter, type LLMRequest, type LLMResponse } from '../types'
import { type LLMError, toLLMError } from '../errors'
import { LLMHttpClient, createLLMHttpClient } from '../http/client'

// CID:llm-gemini-001 - GeminiAdapterConfig
// Purpose: Configure Gemini base URL, model, and API key
// Uses: (none)
// Used by: GeminiAdapter constructor callers
export interface GeminiAdapterConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
}

// CID:llm-gemini-002 - GeminiHealthCheckResult
// Purpose: Setup-wizard-friendly health check result
// Uses: LLMError
// Used by: runtime/UI setup flows (Phase-1)
export type GeminiHealthCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; error: LLMError }

// CID:llm-gemini-003 - GeminiAdapter
// Purpose: LLMAdapter implementation for Gemini cloud via HTTP
// Uses: LLMHttpClient, /models, /models/{model}:generateContent
// Used by: LLMRouter (once wired by M10-L6+)
export class GeminiAdapter implements LLMAdapter {
  id = 'gemini'
  label = 'Gemini'

  private baseUrl: string
  private defaultModel?: string
  private apiKey: string
  private client: LLMHttpClient

  private modelCache?: { models: string[]; fetchedAt: number }

  constructor(config: GeminiAdapterConfig, deps?: { client?: LLMHttpClient }) {
    const defaultBase = 'https://generativelanguage.googleapis.com/v1beta'
    const inputBase = (config.baseUrl ?? defaultBase).trim()
    const looksLikeGemini = /generativelanguage\.googleapis\.com\/(v1beta|v1)/.test(inputBase)
    if (config.baseUrl && !looksLikeGemini) {
      console.warn('[GeminiAdapter] Ignoring unexpected baseUrl override; falling back to default', {
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
      throw toLLMError(new Error('Missing Gemini API key'), {
        code: 'llm.misconfigured',
        message: 'Missing Gemini API key',
        provider: this.id,
        retryable: false,
      })
    }
  }

  private buildUrl(path: string): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`
    const normalized = path.replace(/^\/+/, '')
    return new URL(normalized, base).toString()
  }

  private withKey(url: string): string {
    const u = new URL(url)
    u.searchParams.set('key', this.apiKey)
    return u.toString()
  }

  // CID:llm-gemini-004 - listModels
  // Purpose: List model names available to the key via /models (cached)
  // Uses: LLMHttpClient.requestJson()
  // Used by: supports(), healthCheck(), assertModelAvailable()
  async listModels(opts?: { bypassCache?: boolean }): Promise<string[]> {
    const ttlMs = 60_000
    if (!opts?.bypassCache && this.modelCache && Date.now() - this.modelCache.fetchedAt < ttlMs) {
      return this.modelCache.models
    }

    const endpoint = this.buildUrl('models')
    console.log('[GeminiAdapter] listModels', { baseUrl: this.baseUrl, endpoint })
    const url = this.withKey(endpoint)
    const json = await this.client.requestJson<any>(url, {
      method: 'GET',
      provider: this.id,
    })

    const rawModels: any[] = Array.isArray(json?.models) ? json.models : []

    const hasGenerationMethodsField = rawModels.some(m => Array.isArray(m?.supportedGenerationMethods))
    const filtered = hasGenerationMethodsField
      ? rawModels.filter(m =>
          Array.isArray(m?.supportedGenerationMethods)
            ? (m.supportedGenerationMethods as any[]).some(x => x === 'generateContent')
            : false,
        )
      : rawModels

    const models = filtered
      .map((m: any) => (typeof m?.name === 'string' ? m.name : undefined))
      .filter((name: any) => typeof name === 'string')

    this.modelCache = { models, fetchedAt: Date.now() }
    return models
  }

  // CID:llm-gemini-005 - healthCheck
  // Purpose: Verify connectivity/key validity by calling /models
  // Uses: listModels(), toLLMError()
  // Used by: setup wizard / runtime config validation
  async healthCheck(): Promise<GeminiHealthCheckResult> {
    try {
      const models = await this.listModels({ bypassCache: true })
      return { ok: true, models }
    } catch (err) {
      return {
        ok: false,
        error: toLLMError(err, {
          message: 'Failed to connect to Gemini',
          provider: this.id,
        }),
      }
    }
  }

  // CID:llm-gemini-006 - supports + assertModelAvailable
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
    let models: string[] = []
    try {
      models = await this.listModels()
    } catch {
      return
    }

    if (!models.length) return
    if (models.includes(model)) return

    const suggestions = models
      .filter(m => typeof m === 'string' && m.startsWith('models/gemini'))
      .slice(0, 8)

    const hint = suggestions.length ? ` Available models include: ${suggestions.join(', ')}` : ''

    throw toLLMError(new Error(`Gemini model '${model}' not found.${hint}`), {
      code: 'llm.model_not_found',
      message: `Gemini model '${model}' not found.${hint}`,
      provider: this.id,
      retryable: false,
    })
  }

  // CID:llm-gemini-007 - generate
  // Purpose: Perform a non-streaming completion via /models/{model}:generateContent
  // Uses: LLMHttpClient, Gemini request/response shapes, assertModelAvailable
  // Used by: Planner and any LLM-driven features
  async generate(request: LLMRequest, options?: { model?: string }): Promise<LLMResponse> {
    let model = (options?.model ?? this.defaultModel ?? '').trim()
    if (!model.length) {
      throw toLLMError(new Error('No Gemini model configured'), {
        code: 'llm.misconfigured',
        message: 'No Gemini model configured',
        provider: this.id,
        retryable: false,
      })
    }

    if (!model.startsWith('models/')) {
      model = `models/${model}`
    }

    await this.assertModelAvailable(model)

    const endpoint = this.buildUrl(`${model}:generateContent`)
    console.log('[GeminiAdapter] generate', {
      baseUrl: this.baseUrl,
      model,
      endpoint,
      requestId: request.metadata?.requestId,
    })
    const url = this.withKey(endpoint)

    const body: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: request.prompt }],
        },
      ],
    }

    if (typeof request.system === 'string' && request.system.trim().length) {
      body.systemInstruction = {
        parts: [{ text: request.system }],
      }
    }

    const generationConfig: any = {}
    if (typeof request.temperature === 'number') {
      generationConfig.temperature = request.temperature
    }
    if (typeof request.maxTokens === 'number') {
      generationConfig.maxOutputTokens = request.maxTokens
    }
    if (Object.keys(generationConfig).length) {
      body.generationConfig = generationConfig
    }

    let json: any
    try {
      json = await this.client.requestJson<any>(url, {
        method: 'POST',
        body: JSON.stringify(body),
        provider: this.id,
        requestId: request.metadata?.requestId,
      })
    } catch (err) {
      const e: any = err as any
      const debug = e && typeof e === 'object' ? (e.debug as any) : undefined
      console.warn('[GeminiAdapter] generate failed', {
        model,
        endpoint,
        code: typeof e?.code === 'string' ? e.code : undefined,
        status: typeof e?.status === 'number' ? e.status : undefined,
        statusText: typeof debug?.statusText === 'string' ? debug.statusText : undefined,
        responseBodySnippet: typeof debug?.responseBodySnippet === 'string' ? debug.responseBodySnippet : undefined,
      })
      throw err
    }

    const parts = Array.isArray(json?.candidates?.[0]?.content?.parts) ? json.candidates[0].content.parts : []
    const text = parts
      .map((p: any) => (p && typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('')

    if (!text.length) {
      throw toLLMError(new Error('Gemini returned an empty response'), {
        code: 'llm.unknown',
        message: 'Gemini returned an empty response',
        provider: this.id,
      })
    }

    const promptTokens =
      typeof json?.usageMetadata?.promptTokenCount === 'number' ? json.usageMetadata.promptTokenCount : undefined
    const completionTokens =
      typeof json?.usageMetadata?.candidatesTokenCount === 'number' ? json.usageMetadata.candidatesTokenCount : undefined

    return {
      text,
      model,
      tokens:
        typeof promptTokens === 'number' && typeof completionTokens === 'number'
          ? { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens }
          : undefined,
      raw: {
        provider: 'gemini',
        cloud: true,
        response: json,
      },
    }
  }
}
