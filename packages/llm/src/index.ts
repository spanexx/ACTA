/*
 * Code Map: LLM Package Public API
 * - Re-export version, core types, error taxonomy, shared HTTP client, and router
 *
 * CID Index:
 * CID:llm-index-001 -> Public API re-exports
 *
 * Quick lookup: rg -n "CID:llm-index-" /home/spanexx/Shared/Projects/ACTA/packages/llm/src/index.ts
 */

// CID:llm-index-001 - Public API re-exports
// Purpose: Provide a stable barrel export surface for @acta/llm
// Uses: version.ts, types.ts, errors.ts, http/client.ts, router.ts
// Used by: @acta/agent, @acta/runtime, and adapter implementations
export { LLM_VERSION } from './version'
export { type LLMRequest, type LLMResponse, type LLMAdapter } from './types'
export { type LLMErrorCode, type LLMError, isLLMError, toLLMError } from './errors'
export {
  type LLMHttpClientOptions,
  type LLMHttpRequestOptions,
  LLMHttpClient,
  createLLMHttpClient,
} from './http/client'
export { type LLMRouterOptions, LLMRouter } from './router'
export {
  OllamaAdapter,
  type OllamaAdapterConfig,
  type OllamaHealthCheckResult,
  LMStudioAdapter,
  type LMStudioAdapterConfig,
  type LMStudioHealthCheckResult,
  OpenAIAdapter,
  type OpenAIAdapterConfig,
  type OpenAIHealthCheckResult,
  AnthropicAdapter,
  type AnthropicAdapterConfig,
  type AnthropicHealthCheckResult,
  GeminiAdapter,
  type GeminiAdapterConfig,
  type GeminiHealthCheckResult,
  CustomAIAdapter,
  type CustomAIAdapterConfig,
  type CustomAIHealthCheckResult,
} from './providers'
