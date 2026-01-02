// Code explain tool implementation
// Reads code files and produces plain-language explanations

import { ActaTool, ToolResult, ToolContext } from '@acta/core'
import * as fs from 'fs/promises'
import * as path from 'path'

interface ExplainInput {
  path: string
  maxLength?: number
}

function generateCodeExplanation(code: string, language: string): string {
  const lines = code.split('\n')
  const lineCount = lines.length
  const charCount = code.length
  
  let explanation = `Code Explanation (${language.toUpperCase()}):\n\n`
  explanation += `This file contains ${lineCount} lines of ${language} code (${charCount} characters).\n\n`

  const imports = lines.filter(l => l.trim().startsWith('import ') || l.trim().startsWith('require('))
  const functions = lines.filter(l => l.trim().startsWith('function ') || l.trim().match(/^\s*(async\s+)?[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/))
  const classes = lines.filter(l => l.trim().startsWith('class '))
  const exports = lines.filter(l => l.trim().startsWith('export ') || l.trim().startsWith('module.exports'))

  if (imports.length > 0) {
    explanation += `Imports/Dependencies:\n`
    imports.forEach(imp => {
      explanation += `- ${imp.trim()}\n`
    })
    explanation += '\n'
  }

  if (classes.length > 0) {
    explanation += `Classes defined:\n`
    classes.forEach(cls => {
      explanation += `- ${cls.trim()}\n`
    })
    explanation += '\n'
  }

  if (functions.length > 0) {
    explanation += `Functions/methods detected: ${functions.length}\n`
    functions.slice(0, 5).forEach(fn => {
      explanation += `- ${fn.trim()}\n`
    })
    if (functions.length > 5) {
      explanation += `- ... and ${functions.length - 5} more\n`
    }
    explanation += '\n'
  }

  if (exports.length > 0) {
    explanation += `Exports:\n`
    exports.forEach(exp => {
      explanation += `- ${exp.trim()}\n`
    })
    explanation += '\n'
  }

  const preview = lines.slice(0, 5).join('\n')
  if (preview) {
    explanation += `Code preview (first 5 lines):\n${preview}\n`
    if (lineCount > 5) {
      explanation += `... (${lineCount - 5} more lines)\n`
    }
  }

  return explanation
}

export const code_explain: ActaTool = {
  meta: {
    id: 'code.explain',
    name: 'Code Explain',
    version: '1.0.0',
    author: 'Acta Core',
    description: 'Reads a code file and produces a detailed explanation',
    domain: 'analysis',
    permissions: {
      read: true,
      write: false,
      execute: false
    },
    riskLevel: 'low',
    reversible: true,
    sandbox: true,
    entry: 'index.ts',
    supportedFormats: ['ts', 'js', 'py', 'java', 'html', 'css', 'json', 'md']
  },

  async execute(input: ExplainInput, context: ToolContext): Promise<ToolResult> {
    try {
      if (!input || typeof input.path !== 'string') {
        return {
          success: false,
          error: 'Invalid input: path is required and must be a string'
        }
      }

      const filePath = path.resolve(context.workingDir, input.path)
      const ext = path.extname(filePath).slice(1).toLowerCase()

      if (!filePath.startsWith(context.workingDir)) {
        return {
          success: false,
          error: 'Path traversal detected: file path must be within working directory'
        }
      }

      const supportedFormats = ['ts', 'js', 'py', 'java', 'html', 'css', 'json', 'md']
      if (!supportedFormats.includes(ext)) {
        return {
          success: false,
          error: `Unsupported file format: ${ext}. Supported: ${supportedFormats.join(', ')}`
        }
      }

      const code = await fs.readFile(filePath, 'utf-8')
      
      if (!code.trim()) {
        return {
          success: false,
          error: 'File is empty'
        }
      }

      const maxLength = input.maxLength || 4000
      const truncatedCode = code.length > maxLength 
        ? code.substring(0, maxLength) + '...' 
        : code

      const explanation = generateCodeExplanation(truncatedCode, ext)

      return {
        success: true,
        output: explanation,
        artifacts: [filePath],
        log: `Explained ${ext} file (${code.length} characters)`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to explain code'
      return {
        success: false,
        error: errorMessage
      }
    }
  }
}

export default code_explain
