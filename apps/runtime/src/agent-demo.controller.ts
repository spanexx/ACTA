import { Controller, Get, Query } from '@nestjs/common'
import { Planner, SafetyGate, ExecutionOrchestrator } from '@acta/agent'
import { LLMRouter, type LLMAdapter, type LLMRequest, type LLMResponse } from '@acta/llm'
import { createDefaultRegistry } from '@acta/tools'
import { createLogger } from '@acta/logging'
import type { TrustProfile } from '@acta/trust'

class MockLLMAdapter implements LLMAdapter {
  id = 'mock-agent-demo'
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const planJson = JSON.stringify({
      goal: `Process: ${request.prompt.substring(0, 50)}...`,
      steps: [
        {
          id: 'step-1',
          tool: 'explain.content',
          intent: 'analyze input',
          input: { text: request.prompt },
          requiresPermission: false,
        },
      ],
    })
    return {
      text: `Here is the plan:\n\`\`\`json\n${planJson}\n\`\`\``,
      tokens: { prompt: 10, completion: 20, total: 30 },
      model: 'mock-model',
    }
  }
  supports(): boolean {
    return true
  }
}

@Controller('agent-demo')
export class AgentDemoController {
  @Get()
  async run(@Query('input') input = 'Hello Acta, process this request.') {
    const logger = createLogger('agent-demo')
    const events: Array<{ type: string; payload: any }> = []

    const profile: TrustProfile = {
      profileId: 'agent-demo',
      defaultTrustLevel: 2,
    }

    const tools = await createDefaultRegistry()
    const toolList = await tools.list()

    const llmRouter = new LLMRouter()
    llmRouter.register(new MockLLMAdapter())

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
