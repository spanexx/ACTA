// LLM package baseline (Phase-1)
export const LLM_VERSION = "0.1.0"

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

export interface LLMRouterOptions {
  /** Default adapter id when none is provided. */
  defaultAdapterId?: string
}

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

