import type { ActaMessage, LLMHealthCheckPayload, LLMHealthCheckRequest } from '@acta/ipc'

import { createLogger } from '@acta/logging'

import {
  AnthropicAdapter,
  CustomAIAdapter,
  GeminiAdapter,
  LMStudioAdapter,
  OllamaAdapter,
  OpenAIAdapter,
  toLLMError,
} from '@acta/llm'

import type { EmitMessage } from '../profile-handlers'
import type { ProfileService } from '../../../profile.service'

export function handleLLMHealthCheck(opts: {
  profileService: ProfileService
  emitMessage: EmitMessage
}): (msg: ActaMessage<LLMHealthCheckRequest>) => Promise<void> {
  return async (msg: ActaMessage<LLMHealthCheckRequest>): Promise<void> => {
    const logger = createLogger('llm-health', 'info')
    const activeId = opts.profileService.getActiveProfileId()
    const profileId = msg.payload?.profileId ?? activeId ?? undefined

    let payload: LLMHealthCheckPayload
    let adapterId: string | undefined
    let baseUrl: string | undefined
    let model: string | undefined

    try {
      const profile = await opts.profileService.getProfile(profileId)

      const profileConfig: any = profile.llm ?? {}
      const requestConfig: any = (msg.payload?.config ?? {}) as any

      const mergedConfig: any = {
        ...profileConfig,
        ...requestConfig,
      }

      const requestedAdapterId = typeof requestConfig.adapterId === 'string' ? requestConfig.adapterId : undefined
      const profileAdapterId = typeof profileConfig.adapterId === 'string' ? profileConfig.adapterId : undefined
      const effectiveAdapterId = requestedAdapterId ?? profileAdapterId
      const requestedMode = typeof requestConfig.mode === 'string' ? requestConfig.mode : undefined
      const isCloudProvider =
        requestedMode === 'cloud' ||
        effectiveAdapterId === 'openai' ||
        effectiveAdapterId === 'anthropic' ||
        effectiveAdapterId === 'gemini'

      const requestProvidedBaseUrl = requestConfig.baseUrl !== undefined || requestConfig.endpoint !== undefined

      if ((requestedAdapterId && requestedAdapterId !== profileAdapterId && !requestProvidedBaseUrl) || (isCloudProvider && !requestProvidedBaseUrl)) {
        mergedConfig.baseUrl = undefined
        mergedConfig.endpoint = undefined
      }

      if (
        mergedConfig.baseUrl === undefined &&
        typeof mergedConfig.endpoint === 'string' &&
        mergedConfig.endpoint.trim().length
      ) {
        mergedConfig.baseUrl = mergedConfig.endpoint
      }
      if (
        mergedConfig.endpoint === undefined &&
        typeof mergedConfig.baseUrl === 'string' &&
        mergedConfig.baseUrl.trim().length
      ) {
        mergedConfig.endpoint = mergedConfig.baseUrl
      }

      adapterId = typeof mergedConfig.adapterId === 'string' ? mergedConfig.adapterId : undefined
      baseUrl = typeof mergedConfig.baseUrl === 'string' ? mergedConfig.baseUrl : undefined
      model = typeof mergedConfig.model === 'string' ? mergedConfig.model : undefined
      const apiKey = typeof mergedConfig.apiKey === 'string' ? mergedConfig.apiKey : undefined

      const adapter: any =
        adapterId === 'ollama'
          ? new OllamaAdapter({ baseUrl, model })
          : adapterId === 'lmstudio'
            ? new LMStudioAdapter({ baseUrl, model })
            : adapterId === 'openai'
              ? new OpenAIAdapter({ apiKey: apiKey ?? '', baseUrl, model })
              : adapterId === 'anthropic'
                ? new AnthropicAdapter({ apiKey: apiKey ?? '', baseUrl, model })
                : adapterId === 'gemini'
                  ? new GeminiAdapter({ apiKey: apiKey ?? '', baseUrl, model })
                  : adapterId === 'custom'
                    ? new CustomAIAdapter({
                        baseUrl: typeof mergedConfig.baseUrl === 'string' ? mergedConfig.baseUrl : mergedConfig.endpoint ?? '',
                        model,
                        headers: typeof mergedConfig.headers === 'object' ? mergedConfig.headers : undefined,
                      })
                    : null

      if (!adapterId || !adapter) {
        throw toLLMError(new Error('No LLM provider configured'), {
          code: 'llm.misconfigured',
          message: 'No LLM provider configured',
          provider: adapterId,
          retryable: false,
        })
      }

      if (typeof adapter.healthCheck !== 'function') {
        throw toLLMError(new Error('LLM adapter does not support healthCheck'), {
          code: 'llm.unknown',
          message: 'LLM adapter does not support healthCheck',
          provider: adapterId,
          retryable: false,
        })
      }

      const res = await adapter.healthCheck()
      payload = {
        ok: Boolean(res?.ok),
        models: Array.isArray(res?.models) ? res.models : undefined,
        error:
          res?.ok === false && res?.error
            ? { code: (res.error as any).code, message: (res.error as any).message ?? 'Health check failed' }
            : undefined,
      }

      if (!payload.ok) {
        logger.warn('LLM health check failed', {
          adapterId,
          baseUrl,
          model,
          errorCode: payload.error?.code,
          errorMessage: payload.error?.message,
        })
      }
    } catch (err) {
      const e = toLLMError(err, { code: 'llm.unknown', message: 'Health check failed', retryable: false })
      logger.error('LLM health check threw', { adapterId, baseUrl, model, errorCode: e.code, errorMessage: e.message })
      payload = { ok: false, error: { code: e.code, message: e.message } }
    }

    opts.emitMessage('llm.healthCheck', payload, {
      source: 'system',
      replyTo: msg.id,
      correlationId: msg.correlationId,
      profileId: activeId ?? undefined,
    })
  }
}
