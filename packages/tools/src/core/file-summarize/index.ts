/*
 * Code Map: Core File Summarize Tool
 * - Helper generateSummary(): Produces stats + preview for supported formats.
 * - Tool metadata/execute: Validates paths/formats, truncates content, returns summary.
 *
 * CID Index:
 * CID:core-file-summarize-001 -> SummarizeInput type
 * CID:core-file-summarize-002 -> generateSummary helper
 * CID:core-file-summarize-003 -> tool metadata
 * CID:core-file-summarize-004 -> execute
 *
 * Lookup: rg -n "CID:core-file-summarize-" packages/tools/src/core/file-summarize/index.ts
 */
import { ActaTool, ToolResult, ToolContext } from '@acta/core'
import * as fs from 'fs/promises'
import * as path from 'path'

// CID:core-file-summarize-001 - Summarize Input
// Purpose: Defines request payload for summary tool.
interface SummarizeInput {
  path: string
  maxLength?: number
}

// CID:core-file-summarize-002 - generateSummary
// Purpose: Builds summary describing counts/structure per format.
function generateSummary(content: string, format: string): string {
  const lines = content.split('\n').filter(l => l.trim())
  const lineCount = lines.length
  const charCount = content.length
  const wordCount = content.split(/\s+/).filter(w => w).length

  let summary = `File Summary (${format.toUpperCase()}):\n`
  summary += `- Lines: ${lineCount}\n`
  summary += `- Words: ${wordCount}\n`
  summary += `- Characters: ${charCount}\n`

  if (format === 'csv') {
    const headers = lines[0]?.split(',').map(h => h.trim()) || []
    summary += `- Columns: ${headers.length}\n`
    summary += `- Column names: ${headers.join(', ')}\n`
    summary += `- Data rows: ${Math.max(0, lineCount - 1)}\n`
  } else if (format === 'json') {
    try {
      const json = JSON.parse(content)
      if (Array.isArray(json)) {
        summary += `- Type: Array\n`
        summary += `- Items: ${json.length}\n`
        if (json.length > 0) {
          summary += `- Sample keys: ${Object.keys(json[0]).join(', ')}\n`
        }
      } else {
        summary += `- Type: Object\n`
        summary += `- Keys: ${Object.keys(json).join(', ')}\n`
      }
    } catch {
      summary += `- Type: Invalid JSON\n`
    }
  }

  const preview = lines.slice(0, 3).join('\n')
  if (preview) {
    summary += `\nPreview:\n${preview}${lineCount > 3 ? '\n...' : ''}`
  }

  return summary
}

// CID:core-file-summarize-003 - Tool Metadata
// Purpose: Describes file.summarize manifest exposed to registry.
export const file_summarize: ActaTool = {
  meta: {
    id: 'file.summarize',
    name: 'File Summarize',
    version: '1.0.0',
    author: 'Acta Core',
    description: 'Summarizes file content using LLM (supports TXT, CSV, JSON, MD)',
    domain: 'analysis',
    permissions: {
      read: true,
      write: false,
      execute: false
    },
    riskLevel: 'medium',
    reversible: true,
    sandbox: true,
    entry: 'index.ts',
    supportedFormats: ['txt', 'csv', 'json', 'md']
  },

  // CID:core-file-summarize-004 - Execute
  // Purpose: Validates input, prevents traversal, truncates content, generates summary.
  async execute(input: SummarizeInput, context: ToolContext): Promise<ToolResult> {
    try {
      if (!input || typeof input.path !== 'string') {
        return {
          success: false,
          error: 'Invalid input: path is required and must be a string'
        }
      }

      const filePath = path.resolve(context.cwd, input.path)
      const ext = path.extname(filePath).slice(1).toLowerCase()

      if (!filePath.startsWith(context.cwd)) {
        return {
          success: false,
          error: 'Path traversal detected: file path must be within cwd'
        }
      }

      const supportedFormats = ['txt', 'csv', 'json', 'md']
      if (!supportedFormats.includes(ext)) {
        return {
          success: false,
          error: `Unsupported file format: ${ext}. Supported: ${supportedFormats.join(', ')}`
        }
      }

      const content = await fs.readFile(filePath, 'utf-8')
      
      if (!content.trim()) {
        return {
          success: false,
          error: 'File is empty'
        }
      }

      const maxLength = input.maxLength || 4000
      const truncatedContent = content.length > maxLength 
        ? content.substring(0, maxLength) + '...' 
        : content

      const summary = generateSummary(truncatedContent, ext)

      return {
        success: true,
        output: summary,
        artifacts: [filePath],
        log: `Summarized ${ext} file (${content.length} characters)`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to summarize file'
      return {
        success: false,
        error: errorMessage
      }
    }
  }
}

export default file_summarize
