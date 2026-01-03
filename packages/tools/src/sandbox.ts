/*
 * Code Map: Tool Sandbox
 * - Sandbox types/default config for controlling execution limits.
 * - ToolSandbox class providing execute + path guard helpers.
 * - Factory helper for convenience creation.
 *
 * CID Index:
 * CID:tools-sandbox-001 -> Sandbox types + DEFAULT_CONFIG
 * CID:tools-sandbox-002 -> ToolSandbox class
 * CID:tools-sandbox-003 -> execute
 * CID:tools-sandbox-004 -> validateFilePath
 * CID:tools-sandbox-005 -> getSafePath
 * CID:tools-sandbox-006 -> createSandbox factory
 *
 * Lookup: rg -n "CID:tools-sandbox-" packages/tools/src/sandbox.ts
 */
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { ActaTool, ToolResult, ToolContext } from '@acta/core'
import { Logger } from '@acta/logging'
import * as path from 'path'

// CID:tools-sandbox-001 - Sandbox Types & Defaults
// Purpose: Shapes configuration/requests/responses and provides default limits.
export interface SandboxConfig {
  timeoutMs: number
  allowedDirectories: string[]
  maxMemoryMB?: number
}

export interface SandboxRequest {
  toolPath: string
  input: any
  context: ToolContext
  config: SandboxConfig
}

export interface SandboxResponse {
  success: boolean
  result?: ToolResult
  error?: string
  timeout?: boolean
}

const DEFAULT_CONFIG: SandboxConfig = {
  timeoutMs: 30000,
  allowedDirectories: [process.cwd()],
  maxMemoryMB: 128
}

// CID:tools-sandbox-002 - ToolSandbox Class
// Purpose: Encapsulates sandbox execution behavior with logger + config.
export class ToolSandbox {
  private config: SandboxConfig
  private logger: Logger

  constructor(config?: Partial<SandboxConfig>, logger?: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = logger || {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    }
  }

  // CID:tools-sandbox-003 - execute
  // Purpose: Executes a tool with timeout handling and structured logging.
  async execute(
    tool: ActaTool,
    input: any,
    context: ToolContext
  ): Promise<ToolResult> {
    this.logger.info('Executing tool in sandbox', {
      toolId: tool.meta.id,
      timeout: this.config.timeoutMs
    })

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.logger.warn('Tool execution timed out', {
          toolId: tool.meta.id,
          timeout: this.config.timeoutMs
        })
        resolve({
          success: false,
          error: `Tool execution timed out after ${this.config.timeoutMs}ms`
        })
      }, this.config.timeoutMs)

      try {
        tool
          .execute(input, context)
          .then((result) => {
            clearTimeout(timeoutId)
            resolve(result)
          })
          .catch((error) => {
            clearTimeout(timeoutId)
            this.logger.error('Tool execution failed', {
              toolId: tool.meta.id,
              error: error.message
            })
            resolve({
              success: false,
              error: error.message || 'Tool execution failed'
            })
          })
      } catch (error) {
        clearTimeout(timeoutId)
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })
  }

  // CID:tools-sandbox-004 - validateFilePath
  // Purpose: Checks whether a path resides within allowed directories.
  validateFilePath(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath)
    
    for (const allowedDir of this.config.allowedDirectories) {
      const resolvedAllowedDir = path.resolve(allowedDir)
      if (resolvedPath.startsWith(resolvedAllowedDir)) {
        return true
      }
    }
    
    return false
  }

  // CID:tools-sandbox-005 - getSafePath
  // Purpose: Resolves a requested path relative to base while preventing traversal.
  getSafePath(basePath: string, requestedPath: string): string | null {
    const resolvedBase = path.resolve(basePath)
    const resolvedRequested = path.resolve(basePath, requestedPath)
    
    if (!resolvedRequested.startsWith(resolvedBase)) {
      return null
    }
    
    return resolvedRequested
  }
}

// CID:tools-sandbox-006 - createSandbox factory
// Purpose: Convenience helper to instantiate ToolSandbox with overrides.
export function createSandbox(config?: Partial<SandboxConfig>, logger?: Logger): ToolSandbox {
  return new ToolSandbox(config, logger)
}
