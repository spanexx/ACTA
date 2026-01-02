// Tool registry implementation
// Manages tool registration, execution, and audit logging

import { ToolManifest, ToolResult, ToolContext, ActaTool } from '@acta/core'
import { ToolValidator } from './validator'
import { Logger } from '@acta/logging'
import { logExecutionAudit } from './registry/audit'
import type { AgentStep, ExecutionContext } from './registry/types'

export type { AgentStep, ExecutionContext } from './registry/types'

export class ToolRegistry {
  private tools = new Map<string, ActaTool>()
  private validator: ToolValidator
  private logger: Logger

  constructor(logger: Logger) {
    this.validator = new ToolValidator()
    this.logger = logger
  }

  register(tool: ActaTool): void {
    try {
      this.validator.validateManifest(tool.meta)
      
      if (this.tools.has(tool.meta.id)) {
        this.logger.warn(`Tool already registered, overwriting: ${tool.meta.id}`)
      }
      
      this.tools.set(tool.meta.id, tool)
      this.logger.info(`Tool registered: ${tool.meta.id}`, {
        name: tool.meta.name,
        version: tool.meta.version,
        riskLevel: tool.meta.riskLevel
      })
    } catch (error) {
      this.logger.error(`Failed to register tool: ${tool.meta.id || 'unknown'}`, error)
      throw error
    }
  }

  unregister(toolId: string): boolean {
    const tool = this.tools.get(toolId)
    if (!tool) {
      this.logger.warn(`Attempted to unregister non-existent tool: ${toolId}`)
      return false
    }
    
    this.tools.delete(toolId)
    this.logger.info(`Tool unregistered: ${toolId}`)
    return true
  }

  get(toolId: string): ActaTool | undefined {
    return this.tools.get(toolId)
  }

  listTools(): ToolManifest[] {
    return Array.from(this.tools.values()).map(tool => tool.meta)
  }

  isRegistered(toolId: string): boolean {
    return this.tools.has(toolId)
  }

  async execute(step: AgentStep, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now()
    
    this.logger.info(`Executing tool: ${step.tool}`, {
      stepId: step.id,
      taskId: context.taskId,
      profileId: context.profileId
    })

    const tool = this.tools.get(step.tool)
    
    if (!tool) {
      const error = `Tool not found: ${step.tool}`
      this.logger.error(error, { stepId: step.id })
      
      logExecutionAudit(this.logger, {
        toolId: step.tool,
        stepId: step.id,
        success: false,
        error,
        duration: Date.now() - startTime,
        context
      })
      
      return {
        success: false,
        error
      }
    }

    try {
      const result = await tool.execute(step.input, context)
      
      this.logger.info(`Tool execution completed: ${step.tool}`, {
        stepId: step.id,
        success: result.success,
        artifacts: result.artifacts,
        duration: Date.now() - startTime
      })

      logExecutionAudit(this.logger, {
        toolId: step.tool,
        stepId: step.id,
        success: result.success,
        artifacts: result.artifacts,
        output: result.output,
        error: result.error,
        duration: Date.now() - startTime,
        context
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      this.logger.error(`Tool execution failed: ${step.tool}`, {
        stepId: step.id,
        error: errorMessage,
        duration: Date.now() - startTime
      })

      logExecutionAudit(this.logger, {
        toolId: step.tool,
        stepId: step.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
        context
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  getToolCount(): number {
    return this.tools.size
  }

  clear(): void {
    const count = this.tools.size
    this.tools.clear()
    this.logger.info(`Cleared all tools from registry (${count} tools removed)`)
  }
}
