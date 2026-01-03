/*
 * Code Map: LLM Core Types
 * - LLMRequest: normalized request payload for adapters
 * - LLMResponse: normalized response payload from adapters
 * - LLMAdapter: provider adapter interface
 *
 * CID Index:
 * CID:llm-types-001 -> LLMRequest
 * CID:llm-types-002 -> LLMResponse
 * CID:llm-types-003 -> LLMAdapter
 *
 * Quick lookup: rg -n "CID:llm-types-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/types.ts
 */

// CID:llm-types-001 - LLMRequest
// Purpose: Define request payload for adapters
// Uses: (none)
// Used by: LLMAdapter.generate(), LLMRouter.generate()
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

// CID:llm-types-002 - LLMResponse
// Purpose: Define a normalized completion response
// Uses: (none)
// Used by: LLMAdapter.generate(), LLMRouter.generate(), planner
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

// CID:llm-types-003 - LLMAdapter
// Purpose: Adapter interface for LLM providers
// Uses: LLMRequest, LLMResponse
// Used by: LLMRouter routing and provider implementations
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
