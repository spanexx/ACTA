/*
 * Code Map: LLM Package
 * - LLM_VERSION constant
 * - LLMRequest/LLMResponse/LLMAdapter interfaces
 * - LLMRouterOptions + LLMRouter class (register, routing)
 *
 * CID Index:
 * CID:llm-001 -> LLM_VERSION constant
 * CID:llm-002 -> LLMRequest interface
 * CID:llm-003 -> LLMResponse interface
 * CID:llm-004 -> LLMAdapter interface
 * CID:llm-005 -> LLMRouterOptions interface
 * CID:llm-006 -> LLMRouter class
 *
 * Quick lookup: rg -n "CID:llm-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/index.ts
 */

// CID:llm-001 - LLM_VERSION
// Purpose: Surface LLM package version
export const LLM_VERSION = "0.1.0"

// CID:llm-002 - LLMRequest
// Purpose: Define request payload for adapters
export interface LLMRequest {
  prompt: string
  system?: string
  maxTokens?: number
  temperature?: number
  metadata?: {
    profileId?: string
    requestId?: string
    [key: string]: any
  }
}

// CID:llm-003 - LLMResponse
// Purpose: Shape of LLM completion response
export interface LLMResponse {
  text: string
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  model?: string
  raw?: unknown
}

// CID:llm-004 - LLMAdapter
// Purpose: Adapter interface for LLM providers
export interface LLMAdapter {
  /** Stable identifier, e.g. 'ollama', 'openai', 'anthropic' */
  id: string
  /** Optional human-friendly label */
  label?: string
  /** Return true if this adapter can serve the requested model (if specified). */
  supports(model?: string): boolean | Promise<boolean>
  /** Generate a completion for the given request. */
  generate(request: LLMRequest, options?: { model?: string }): Promise<LLMResponse>
}

// CID:llm-005 - LLMRouterOptions
// Purpose: Configure router defaults
export interface LLMRouterOptions {
  /** Default adapter id when none is provided. */
  defaultAdapterId?: string
}

// CID:llm-006 - LLMRouter
// Purpose: Manage adapters and route generation requests
export class LLMRouter {
  private adapters = new Map<string, LLMAdapter>()
  private defaultAdapterId?: string

  constructor(options?: LLMRouterOptions) {
    this.defaultAdapterId = options?.defaultAdapterId
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
      throw new Error(`Unknown LLM adapter: ${id}`)
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
    if (!adapterId) {
      throw new Error('No LLM adapter registered')
    }
    const adapter = this.adapters.get(adapterId)
    if (!adapter) {
      throw new Error(`Unknown LLM adapter: ${adapterId}`)
    }
    return adapter.generate(request, { model: options?.model })
  }
}

