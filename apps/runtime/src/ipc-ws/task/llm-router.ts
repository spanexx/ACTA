/*
 * Code Map: Task LLM Router
 * - createTaskLLMRouter: Configure an LLMRouter instance based on profile config and runtime mode.
 *
 * CID Index:
 * CID:llm-router-001 -> createTaskLLMRouter
 *
 * Quick lookup: rg -n "CID:llm-router-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/llm-router.ts
 */

import {
  AnthropicAdapter,
  CustomAIAdapter,
  GeminiAdapter,
  LMStudioAdapter,
  LLMRouter,
  OllamaAdapter,
  OpenAIAdapter,
  toLLMError,
} from '@acta/llm'

import type { Profile } from '@acta/profiles'

import { RuntimeMockLLMAdapter } from '../mock-llm.adapter'

// CID:llm-router-001 - createTaskLLMRouter
// Purpose: Create and configure an LLMRouter for task planning, including runtime mock behavior for tests.
// Uses: Profile.llm settings, RuntimeMockLLMAdapter, provider adapters from @acta/llm.
// Used by: runTaskRequest when setting up planning/execution LLM access.
export function createTaskLLMRouter(profileDoc: Profile): LLMRouter {
  const llmRouter = new LLMRouter({
    defaultAdapterId: profileDoc.llm?.adapterId,
  })

  const isTest = process.env.NODE_ENV === 'test'
  if (isTest) {
    llmRouter.register(new RuntimeMockLLMAdapter(profileDoc.llm?.adapterId ?? 'mock-runtime'))
    return llmRouter
  }

  const adapterId = profileDoc.llm?.adapterId
  if (!adapterId) {
    throw toLLMError(new Error('No LLM provider configured'), {
      code: 'llm.misconfigured',
      message: 'No LLM provider configured. Configure an LLM provider in the active profile to enable planning.',
      retryable: false,
    })
  }

  if (adapterId === 'ollama') {
    llmRouter.register(new OllamaAdapter({ baseUrl: profileDoc.llm?.baseUrl, model: profileDoc.llm?.model }))
  } else if (adapterId === 'lmstudio') {
    llmRouter.register(new LMStudioAdapter({ baseUrl: profileDoc.llm?.baseUrl, model: profileDoc.llm?.model }))
  } else if (adapterId === 'openai') {
    llmRouter.register(
      new OpenAIAdapter({
        apiKey: profileDoc.llm?.apiKey ?? '',
        baseUrl: profileDoc.llm?.baseUrl,
        model: profileDoc.llm?.model,
      }),
    )
  } else if (adapterId === 'anthropic') {
    llmRouter.register(
      new AnthropicAdapter({
        apiKey: profileDoc.llm?.apiKey ?? '',
        baseUrl: profileDoc.llm?.baseUrl,
        model: profileDoc.llm?.model,
      }),
    )
  } else if (adapterId === 'gemini') {
    llmRouter.register(
      new GeminiAdapter({
        apiKey: profileDoc.llm?.apiKey ?? '',
        baseUrl: profileDoc.llm?.baseUrl,
        model: profileDoc.llm?.model,
      }),
    )
  } else if (adapterId === 'custom') {
    llmRouter.register(
      new CustomAIAdapter({
        baseUrl: profileDoc.llm?.baseUrl ?? profileDoc.llm?.endpoint ?? '',
        model: profileDoc.llm?.model,
        headers: profileDoc.llm?.headers,
      }),
    )
  } else {
    throw toLLMError(new Error(`Unknown LLM provider: ${adapterId}`), {
      code: 'llm.misconfigured',
      message: `Unknown LLM provider: ${adapterId}`,
      provider: adapterId,
      retryable: false,
    })
  }

  return llmRouter
}
