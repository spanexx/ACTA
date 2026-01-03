import type { LLMAdapter, LLMRequest, LLMResponse } from '@acta/llm'

export class RuntimeMockLLMAdapter implements LLMAdapter {
  id = 'mock-runtime'

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const hasAttachments = request.prompt.includes('Attachments (paths only):')

    const wantsTwoSteps = request.prompt.includes('test:two-steps')
    const forceToolMissing = request.prompt.includes('test:tool-missing')
    const forceToolFail = request.prompt.includes('test:tool-fail')
    const forceSlow = request.prompt.includes('test:slow')

    const toolId = forceToolMissing ? 'missing.tool' : 'explain.content'
    const step1Text = forceToolFail ? '' : forceSlow ? `SLOW ${request.prompt}` : request.prompt

    const steps = wantsTwoSteps
      ? [
          {
            id: 'step-1',
            tool: toolId,
            intent: 'analyze input',
            input: { text: step1Text },
            requiresPermission: hasAttachments,
          },
          {
            id: 'step-2',
            tool: 'explain.content',
            intent: 'follow up',
            input: { text: request.prompt },
            requiresPermission: false,
          },
        ]
      : [
          {
            id: 'step-1',
            tool: toolId,
            intent: 'analyze input',
            input: { text: step1Text },
            requiresPermission: hasAttachments,
          },
        ]

    const planJson = JSON.stringify({
      goal: `Process: ${request.prompt.substring(0, 50)}...`,
      steps,
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
