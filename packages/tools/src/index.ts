/*
 * Code Map: Tools Package Barrel
 * - Version constant + public exports (validator, registry, loader, sandbox).
 * - Tool domain types/interfaces used across the package.
 * - InMemory registry + helpers for demo/default tooling.
 *
 * CID Index:
 * CID:tools-index-001 -> TOOLS_VERSION
 * CID:tools-index-002 -> package exports (validator/registry/loader/sandbox)
 * CID:tools-index-003 -> PermissionScope/RiskLevel + manifest/context/result types
 * CID:tools-index-004 -> ActaTool/ToolInfo/LegacyToolRegistry interfaces
 * CID:tools-index-005 -> InMemoryToolRegistry class
 * CID:tools-index-006 -> createToolRegistry helper
 * CID:tools-index-007 -> createDemoExplainTool
 * CID:tools-index-008 -> createDefaultRegistry
 *
 * Lookup: rg -n "CID:tools-index-" packages/tools/src/index.ts
 */

// CID:tools-index-001 - Tools Package Version
// Purpose: Surfaces current package version for compatibility checks.
// Used by: Consumers needing runtime version gating
export const TOOLS_VERSION = "0.1.0"

// CID:tools-index-002 - Re-export Core Modules
// Purpose: Exposes validator/registry/loader/sandbox APIs from the package root.
export { ToolValidator, type ValidationResult } from './validator'
export { ToolRegistry, type AgentStep, type ExecutionContext } from './registry'
export { ToolLoader } from './loader'
export { ToolSandbox, createSandbox, type SandboxConfig, type SandboxRequest, type SandboxResponse } from './sandbox'

// CID:tools-index-003 - Permission & Manifest Types
// Purpose: Defines permission scopes, risk levels, and tool manifest metadata.
export type PermissionScope =
  | 'read_files'
  | 'write_files'
  | 'read_clipboard'
  | 'write_clipboard'
  | 'screen_capture'
  | 'network_access'
  | 'shell_execute'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ToolManifest {
  id: string
  name: string
  version: string
  description: string
  author?: string
  capabilities: PermissionScope[]
  riskLevel: RiskLevel
  reversible: boolean
  category?: string
  tags?: string[]
}

export interface ToolContext {
  profileId: string
  cwd: string
  tempDir: string
  permissions: PermissionScope[]
  logger?: (msg: string, meta?: any) => void
}

export interface ToolResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: string[]
}

// CID:tools-index-004 - Tool Interfaces
// Purpose: Public interfaces representing tools and legacy registry contract.
export interface ActaTool {
  meta: ToolManifest
  execute(input: any, ctx: ToolContext): Promise<ToolResult>
}

export interface ToolInfo {
  id: string
  name: string
  version: string
  description: string
  riskLevel: RiskLevel
  reversible: boolean
  capabilities: PermissionScope[]
  category?: string
  tags?: string[]
}

export interface LegacyToolRegistry {
  register(tool: ActaTool): Promise<void>
  unregister(toolId: string): Promise<void>
  get(toolId: string): Promise<ActaTool | undefined>
  list(): Promise<ToolInfo[]>
  isRegistered(toolId: string): Promise<boolean>
}

// CID:tools-index-005 - InMemoryToolRegistry
// Purpose: Simple in-memory implementation satisfying LegacyToolRegistry for demos/tests.
class InMemoryToolRegistry implements LegacyToolRegistry {
  private tools = new Map<string, ActaTool>()

  async register(tool: ActaTool): Promise<void> {
    this.tools.set(tool.meta.id, tool)
  }

  async unregister(toolId: string): Promise<void> {
    this.tools.delete(toolId)
  }

  async get(toolId: string): Promise<ActaTool | undefined> {
    return this.tools.get(toolId)
  }

  async list(): Promise<ToolInfo[]> {
    return Array.from(this.tools.values()).map(t => ({
      id: t.meta.id,
      name: t.meta.name,
      version: t.meta.version,
      description: t.meta.description,
      riskLevel: t.meta.riskLevel,
      reversible: t.meta.reversible,
      capabilities: t.meta.capabilities,
      category: t.meta.category,
      tags: t.meta.tags,
    }))
  }

  async isRegistered(toolId: string): Promise<boolean> {
    return this.tools.has(toolId)
  }
}

// CID:tools-index-006 - createToolRegistry Helper
// Purpose: Factory returning default in-memory legacy registry implementation.
export function createToolRegistry(): LegacyToolRegistry {
  return new InMemoryToolRegistry()
}

// CID:tools-index-007 - createDemoExplainTool
// Purpose: Provides a basic demo tool implementation for testing.
export function createDemoExplainTool(): ActaTool {
  const meta: ToolManifest = {
    id: 'explain.content',
    name: 'Explain Content',
    version: '0.1.0',
    description: 'Explains the provided text content in simple terms',
    capabilities: ['read_files'],
    riskLevel: 'low',
    reversible: true,
    category: 'analysis',
    tags: ['explain', 'analysis'],
  }

  return {
    meta,
    async execute(input: { text?: string }, _ctx: ToolContext): Promise<ToolResult> {
      if (!input || typeof input.text !== 'string' || input.text.length === 0) {
        return { success: false, error: 'No text provided' }
      }

      if (input.text.includes('test:tool-fail')) {
        return { success: false, error: 'Tool failed as requested by test' }
      }

      if (input.text.includes('SLOW')) {
        await new Promise<void>(resolve => setTimeout(resolve, 250))
      }
      // Phase-1 stub: return a trivial transformation
      const summary = input.text.slice(0, 120)
      return { success: true, output: { summary } }
    },
  }
}

// CID:tools-index-008 - createDefaultRegistry
// Purpose: Creates a registry seeded with demo explain tool (for dev/demo flows).
export async function createDefaultRegistry(): Promise<LegacyToolRegistry> {
  const reg = createToolRegistry()
  await reg.register(createDemoExplainTool())
  return reg
}
