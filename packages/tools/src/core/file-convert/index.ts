// File convert tool implementation
// Converts files between supported formats (PDF→TXT, CSV→JSON)

import { ActaTool, ToolResult, ToolContext } from '@acta/core'
import * as fs from 'fs/promises'
import * as path from 'path'

function csvToJson(csv: string): string {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) {
    return JSON.stringify([], null, 2)
  }

  const headers = lines[0].split(',').map(h => h.trim())
  const result: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length === headers.length) {
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = values[index]
      })
      result.push(obj)
    }
  }

  return JSON.stringify(result, null, 2)
}

export const file_convert: ActaTool = {
  meta: {
    id: 'file.convert',
    name: 'File Convert',
    version: '1.0.0',
    author: 'Acta Core',
    description: 'Converts files between supported formats (PDF→TXT, CSV→JSON)',
    domain: 'filesystem',
    permissions: {
      read: true,
      write: true,
      execute: false
    },
    riskLevel: 'medium',
    reversible: false,
    sandbox: true,
    entry: 'index.ts',
    supportedFormats: ['pdf', 'txt', 'csv', 'json']
  },

  async execute(input: { sourcePath: string; targetFormat: string }, context: ToolContext): Promise<ToolResult> {
    try {
      if (!input || typeof input.sourcePath !== 'string' || typeof input.targetFormat !== 'string') {
        return {
          success: false,
          error: 'Invalid input: sourcePath and targetFormat are required strings'
        }
      }

      const sourcePath = path.resolve(context.workingDir, input.sourcePath)
      const sourceExt = path.extname(sourcePath).slice(1).toLowerCase()
      const targetFormat = input.targetFormat.toLowerCase()

      if (!sourcePath.startsWith(context.workingDir)) {
        return {
          success: false,
          error: 'Path traversal detected: source path must be within working directory'
        }
      }

      const sourceContent = await fs.readFile(sourcePath, 'utf-8')
      let convertedContent: string

      if (sourceExt === 'csv' && targetFormat === 'json') {
        convertedContent = csvToJson(sourceContent)
      } else if (sourceExt === 'txt' && targetFormat === 'json') {
        convertedContent = JSON.stringify({ text: sourceContent }, null, 2)
      } else {
        return {
          success: false,
          error: `Conversion from ${sourceExt} to ${targetFormat} not supported in Phase-1`
        }
      }

      const targetPath = sourcePath.replace(new RegExp(`\\.${sourceExt}$`), `.${targetFormat}`)
      
      if (targetPath === sourcePath) {
        return {
          success: false,
          error: 'Cannot overwrite source file with same format'
        }
      }

      await fs.writeFile(targetPath, convertedContent, 'utf-8')

      return {
        success: true,
        output: `File converted: ${targetPath}`,
        artifacts: [targetPath]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert file'
      return {
        success: false,
        error: errorMessage
      }
    }
  }
}

export default file_convert
