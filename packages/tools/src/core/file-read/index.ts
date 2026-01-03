/*
 * Code Map: Core File Read Tool
 * - Metadata describes file.read tool manifest.
 * - execute(): Validates path, enforces cwd sandbox, returns UTF-8 content.
 *
 * CID Index:
 * CID:core-file-read-001 -> file_read meta
 * CID:core-file-read-002 -> execute
 *
 * Lookup: rg -n "CID:core-file-read-" packages/tools/src/core/file-read/index.ts
 */
import { ActaTool, ToolResult, ToolContext } from '@acta/core'
import * as fs from 'fs/promises'
import * as path from 'path'

// CID:core-file-read-001 - Tool Metadata
// Purpose: Defines manifest used by registry/loader for file reading.
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

  // CID:core-file-read-002 - Execute
  // Purpose: Validates input, prevents traversal, reads file as UTF-8, returns content.
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
