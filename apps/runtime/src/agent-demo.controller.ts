import { Controller, Get, Query } from '@nestjs/common'
import { Planner, SafetyGate } from '@acta/agent'
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
import { createDefaultRegistry } from '@acta/tools'
import { createLogger } from '@acta/logging'
import type { TrustProfile } from '@acta/trust'

import { ProfileService } from './profile.service'

@Controller('agent-demo')
export class AgentDemoController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async run(@Query('input') input = 'Hello Acta, process this request.', @Query('profileId') profileId?: string) {
    const logger = createLogger('agent-demo')
    const events: Array<{ type: string; payload: any }> = []

    const profileDoc = await this.profileService.getProfile(profileId)

    const profile: TrustProfile = {
      profileId: profileDoc.id,
      defaultTrustLevel: 2,
    }

    const tools = await createDefaultRegistry()
    const toolList = await tools.list()

    const llmRouter = new LLMRouter({ defaultAdapterId: profileDoc.llm?.adapterId })
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

    const planner = new Planner(llmRouter)
    const safetyGate = new SafetyGate({ blockedTools: [], blockedScopes: [] })

    // NOTE: `@acta/tools` currently exports a LegacyToolRegistry while `ExecutionOrchestrator`
    // expects the newer ToolRegistry interface. Until tool registry types are unified, we keep
    // this controller as a planner/safety demo only.

    logger.info('Starting agent demo', { input })

    const plan = await planner.plan(input, toolList.map(t => t.id))
    logger.info('Plan generated', { goal: plan.goal, stepCount: plan.steps.length })

    safetyGate.validate(plan)
    logger.info('Safety gate passed')

    const success = true
    const results: any[] = []

    return {
      status: 'ok',
      input,
      plan: {
        goal: plan.goal,
        stepCount: plan.steps.length,
      },
      execution: {
        success,
        results,
      },
      events: events.map(e => ({ type: e.type, payload: e.payload })),
    }
  }
}
