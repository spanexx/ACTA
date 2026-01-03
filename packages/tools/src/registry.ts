/*
 * Code Map: Tool Registry
 * - Manages tool registration/unregistration/listing and execution/audit logging.
 * - Validates manifests before registration and emits structured logs.
 *
 * CID Index:
 * CID:tools-registry-001 -> ToolRegistry class
 * CID:tools-registry-002 -> register
 * CID:tools-registry-003 -> unregister
 * CID:tools-registry-004 -> get/list/isRegistered helpers
 * CID:tools-registry-005 -> execute
 * CID:tools-registry-006 -> getToolCount/clear
 *
 * Lookup: rg -n "CID:tools-registry-" packages/tools/src/registry.ts
 */
import { ToolManifest, ToolResult, ToolContext, ActaTool } from '@acta/core'
import { ToolValidator } from './validator'
import { Logger } from '@acta/logging'
import { logExecutionAudit } from './registry/audit'
import type { AgentStep, ExecutionContext } from './registry/types'

export type { AgentStep, ExecutionContext } from './registry/types'

// CID:tools-registry-001 - ToolRegistry
// Purpose: Holds registered tools + validator/logger dependencies.
// Uses: ToolValidator, Logger
// Used by: ToolLoader, runtime execution pipeline
export class ToolRegistry {
  private tools = new Map<string, ActaTool>()
  private validator: ToolValidator
  private logger: Logger

  constructor(logger: Logger) {
    this.validator = new ToolValidator()
    this.logger = logger
  }

  // CID:tools-registry-002 - register
  // Purpose: Validates manifest then stores tool, logging metadata.
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

  // CID:tools-registry-003 - unregister
  // Purpose: Removes tool if present, logging results.
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

  // CID:tools-registry-004 - get/list/isRegistered
  // Purpose: Query helpers for tool metadata.
  get(toolId: string): ActaTool | undefined {
    return this.tools.get(toolId)
  }

  listTools(): ToolManifest[] {
    return Array.from(this.tools.values()).map(tool => tool.meta)
  }

  isRegistered(toolId: string): boolean {
    return this.tools.has(toolId)
  }

  // CID:tools-registry-005 - execute
  // Purpose: Executes a tool step, logging/auditing success/failure.
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

  // CID:tools-registry-006 - getToolCount/clear
  // Purpose: Expose tool count + helper to clear registry (with logging).
  getToolCount(): number {
    return this.tools.size
  }

  clear(): void {
    const count = this.tools.size
    this.tools.clear()
    this.logger.info(`Cleared all tools from registry (${count} tools removed)`)
  }
}
