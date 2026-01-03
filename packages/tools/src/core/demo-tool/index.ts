/*
 * Code Map: Core Demo Tool
 * - Exports `demo_tool` ActaTool used by default registry + loader smoke tests.
 * - Provides trivial execute implementation returning summary output.
 *
 * CID Index:
 * CID:core-demo-tool-001 -> demo_tool meta
 * CID:core-demo-tool-002 -> execute
 *
 * Lookup: rg -n "CID:core-demo-tool-" packages/tools/src/core/demo-tool/index.ts
 */
import { ActaTool, ToolResult, ToolContext } from '@acta/core'

// CID:core-demo-tool-001 - Demo Tool Metadata
// Purpose: Defines demo.tool manifest used by default registry loader tests.
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

  // CID:core-demo-tool-002 - Demo Tool Execute
  // Purpose: Returns a simple echoed response for testing loader/sandbox.
  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    if (input === 'test:tool-fail') {
      return {
        success: false,
        error: 'Tool failed as requested by test'
      }
    }
    return {
      success: true,
      output: `Demo tool executed with input: ${JSON.stringify(input)}`,
      log: `Executed in profile: ${context.profileId}`
    }
  }
}

export default demo_tool
