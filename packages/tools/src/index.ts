// Tools package baseline (Phase-1)
export const TOOLS_VERSION = "0.1.0"

// Tool validator
export { ToolValidator, type ValidationResult } from './validator'

// Tool registry
export { ToolRegistry, type AgentStep, type ExecutionContext } from './registry'

// Tool loader
export { ToolLoader } from './loader'

// Tool sandbox
export { ToolSandbox, createSandbox, type SandboxConfig, type SandboxRequest, type SandboxResponse } from './sandbox'

// Permission scopes aligned with Phase-1 capabilities
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

export function createToolRegistry(): LegacyToolRegistry {
  return new InMemoryToolRegistry()
}

// Demo tool stub: explain content (read-only)
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
      // Phase-1 stub: return a trivial transformation
      const summary = input.text.slice(0, 120)
      return { success: true, output: { summary } }
    },
  }
}

export async function createDefaultRegistry(): Promise<LegacyToolRegistry> {
  const reg = createToolRegistry()
  await reg.register(createDemoExplainTool())
  return reg
}
