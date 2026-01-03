/*
 * Code Map: Runtime Mock LLM Adapter
 * - RuntimeMockLLMAdapter: Deterministic LLM stub for runtime testing
 *
 * CID Index:
 * CID:mock-llm-001 -> RuntimeMockLLMAdapter class
 *
 * Quick lookup: rg -n "CID:mock-llm-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/mock-llm.adapter.ts
 */

import type { LLMAdapter, LLMRequest, LLMResponse } from '@acta/llm'

// CID:mock-llm-001 - RuntimeMockLLMAdapter
// Purpose: Provide deterministic plan generation for runtime tests and mocks
// Uses: LLMAdapter interface, prompt inspection to craft fake plans
// Used by: Runtime task execution for local development/testing
export class RuntimeMockLLMAdapter implements LLMAdapter {
  id: string

  constructor(id = 'mock-runtime') {
    this.id = id
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (request.metadata?.lane === 'chat') {
      return {
        text: `Mock chat response: ${String(request.prompt ?? '').slice(0, 200)}`,
        tokens: { prompt: 5, completion: 10, total: 15 },
        model: 'mock-model',
      }
    }

    const hasAttachments = request.prompt.includes('Attachments (paths only):')

    const wantsTwoSteps = request.prompt.includes('test:two-steps')
    const forceToolMissing = request.prompt.includes('test:tool-missing')
    const forceToolFail = request.prompt.includes('test:tool-fail')
    const forceSlow = request.prompt.includes('test:slow')

    const toolId = forceToolMissing ? 'missing.tool' : 'explain.content'
    const step1Text = forceToolFail ? 'test:tool-fail' : forceSlow ? `SLOW ${request.prompt}` : request.prompt
    const step1Input = { text: step1Text }

    const steps = wantsTwoSteps
      ? [
          {
            id: 'step-1',
            tool: toolId,
            intent: 'analyze input',
            input: step1Input,
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
            input: step1Input,
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
