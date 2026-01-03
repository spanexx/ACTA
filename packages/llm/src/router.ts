/*
 * Code Map: LLM Router
 * - LLMRouterOptions: configure router defaults
 * - LLMRouter: register adapters and route generate() calls
 *
 * CID Index:
 * CID:llm-router-001 -> LLMRouterOptions
 * CID:llm-router-002 -> LLMRouter
 *
 * Quick lookup: rg -n "CID:llm-router-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/router.ts
 */

import { toLLMError } from './errors'
import type { LLMAdapter, LLMRequest, LLMResponse } from './types'

// CID:llm-router-001 - LLMRouterOptions
// Purpose: Configure router defaults
// Uses: (none)
// Used by: LLMRouter constructor callers
export interface LLMRouterOptions {
  /** Default adapter id when none is provided. */
  defaultAdapterId?: string
  /** Default model name when none is provided. */
  defaultModel?: string
}

// CID:llm-router-002 - LLMRouter
// Purpose: Manage adapters and route generation requests
// Uses: LLMAdapter (registry), adapter.generate()
// Used by: planner and any LLM-driven runtime features
export class LLMRouter {
  private adapters = new Map<string, LLMAdapter>()
  private defaultAdapterId?: string
  private defaultModel?: string

  constructor(options?: LLMRouterOptions) {
    this.defaultAdapterId = options?.defaultAdapterId
    this.defaultModel = options?.defaultModel
  }

  register(adapter: LLMAdapter): void {
    this.adapters.set(adapter.id, adapter)
    if (!this.defaultAdapterId) {
      this.defaultAdapterId = adapter.id
    }
  }

  unregister(id: string): void {
    this.adapters.delete(id)
    if (this.defaultAdapterId === id) {
      this.defaultAdapterId = this.adapters.keys().next().value
    }
  }

  setDefaultAdapter(id: string): void {
    if (!this.adapters.has(id)) {
      throw toLLMError(new Error(`Unknown LLM adapter: ${id}`), {
        code: 'llm.misconfigured',
        message: `Unknown LLM adapter: ${id}`,
        provider: id,
        retryable: false,
      })
    }
    this.defaultAdapterId = id
  }

  getAdapter(id: string): LLMAdapter | undefined {
    return this.adapters.get(id)
  }

  /**
   * Route a generate() call to the appropriate adapter.
   * For Phase-1 skeleton, routing is driven by explicit adapterId when provided,
   * otherwise the configured default.
   */
  async generate(
    request: LLMRequest,
    options?: { adapterId?: string; model?: string },
  ): Promise<LLMResponse> {
    const adapterId = options?.adapterId ?? this.defaultAdapterId
    console.log(`[LLM Router] Generating response with adapter: ${adapterId}, model: ${options?.model ?? this.defaultModel}`)
    
    if (!adapterId) {
      throw toLLMError(new Error('No LLM adapter registered'), {
        code: 'llm.misconfigured',
        message: 'No LLM adapter registered',
        retryable: false,
      })
    }
    const adapter = this.adapters.get(adapterId)
    if (!adapter) {
      throw toLLMError(new Error(`Unknown LLM adapter: ${adapterId}`), {
        code: 'llm.misconfigured',
        message: `Unknown LLM adapter: ${adapterId}`,
        provider: adapterId,
        retryable: false,
      })
    }

    const model = options?.model ?? this.defaultModel
    console.log(`[LLM Router] Calling adapter.generate() with request:`, {
      promptLength: request.prompt?.length || 0,
      hasSystem: !!request.system,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      model,
      adapterId
    })
    
    const response = await adapter.generate(request, { model })
    
    console.log(`[LLM Router] Received response:`, {
      textLength: response.text?.length || 0,
      tokens: response.tokens,
      model: response.model
    })
    
    return response
  }
}
