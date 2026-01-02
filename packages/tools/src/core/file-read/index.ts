// File read tool implementation
// Reads UTF-8 content from files with path validation

import { ActaTool, ToolResult, ToolContext } from '@acta/core'
import * as fs from 'fs/promises'
import * as path from 'path'

export const file_read: ActaTool = {
  meta: {
    id: 'file.read',
    name: 'File Read',
    version: '1.0.0',
    author: 'Acta Core',
    description: 'Reads a local file and returns its content as UTF-8 text',
    domain: 'filesystem',
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

  async execute(input: { path: string }, context: ToolContext): Promise<ToolResult> {
    try {
      if (!input || typeof input.path !== 'string') {
        return {
          success: false,
          error: 'Invalid input: path is required and must be a string'
        }
      }

      const filePath = path.resolve(context.cwd, input.path)
      
      if (!filePath.startsWith(context.cwd)) {
        return {
          success: false,
          error: 'Path traversal detected: file path must be within cwd'
        }
      }

      const content = await fs.readFile(filePath, 'utf-8')
      
      return {
        success: true,
        output: content,
        artifacts: [filePath]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to read file'
      return {
        success: false,
        error: errorMessage
      }
    }
  }
}

export default file_read
