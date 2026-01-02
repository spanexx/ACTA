// Demo tool implementation for testing the tool loader

import { ActaTool, ToolResult, ToolContext } from '@acta/core'

export const demo_tool: ActaTool = {
  meta: {
    id: 'demo.tool',
    name: 'Demo Tool',
    version: '1.0.0',
    author: 'Acta Core',
    description: 'A demo tool for testing the tool loader',
    domain: 'demo',
    permissions: {
      read: true,
      write: false,
      execute: false
    },
    riskLevel: 'low',
    reversible: true,
    sandbox: true,
    entry: 'index.ts'
  },

  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    return {
      success: true,
      output: `Demo tool executed with input: ${JSON.stringify(input)}`,
      log: `Executed in profile: ${context.profileId}`
    }
  }
}

export default demo_tool
