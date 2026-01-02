import type { LLMAdapter, LLMRequest, LLMResponse } from '@acta/llm'

export class RuntimeMockLLMAdapter implements LLMAdapter {
  id = 'mock-runtime'

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const hasAttachments = request.prompt.includes('Attachments (paths only):')
    const planJson = JSON.stringify({
      goal: `Process: ${request.prompt.substring(0, 50)}...`,
      steps: [
        {
          id: 'step-1',
          tool: 'explain.content',
          intent: 'analyze input',
          input: { text: request.prompt },
          requiresPermission: hasAttachments,
        },
      ],
    })

    return {
      text: `Here is the plan:\n\n\`\`\`json\n${planJson}\n\`\`\``,
      tokens: { prompt: 10, completion: 20, total: 30 },
      model: 'mock-model',
    }
  }

  supports(): boolean {
    return true
  }
}
