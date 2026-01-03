/*
 * Code Map: Core Tool Types
 * - RiskLevel / ToolPermissions: Basic enums for tool safety
 * - ToolManifest: Metadata describing a tool
 * - ToolInput/ToolContext/ToolResult: Runtime execution contracts
 * - Artifact: Structured artifact metadata
 * - ActaTool: Interface for executable tools
 *
 * CID Index:
 * CID:tool-types-001 -> RiskLevel type
 * CID:tool-types-002 -> ToolPermissions interface
 * CID:tool-types-003 -> ToolManifest interface
 * CID:tool-types-004 -> ToolInput interface
 * CID:tool-types-005 -> ToolContext interface
 * CID:tool-types-006 -> ToolResult interface
 * CID:tool-types-007 -> Artifact interface
 * CID:tool-types-008 -> ActaTool interface
 *
 * Quick lookup: rg -n "CID:tool-types-" /home/spanexx/Shared/Projects/ACTA/packages/core/src/types/tool.ts
 */

// CID:tool-types-001 - RiskLevel type
// Purpose: Enumerate tool safety levels
export type RiskLevel = 'low' | 'medium' | 'high'

// CID:tool-types-002 - ToolPermissions
// Purpose: Declare permissions a tool requests
export interface ToolPermissions {
  read: boolean
  write: boolean
  execute: boolean
}

// CID:tool-types-003 - ToolManifest
// Purpose: Describe complete metadata contract for tools
// Used by: Tool registry, orchestrator
export interface ToolManifest {
  id: string
  name: string
  version: string
  author?: string
  description: string
  domain?: string
  permissions: ToolPermissions
  riskLevel: RiskLevel
  reversible: boolean
  sandbox?: boolean
  entry: string
  supportedFormats?: string[]
  inputSchema?: any
  [key: string]: any
}

// CID:tool-types-004 - ToolInput
// Purpose: Loose typed input payload for tools
export interface ToolInput {
  [key: string]: any
}

// CID:tool-types-005 - ToolContext
// Purpose: Describe runtime context made available to tools
export interface ToolContext {
  profileId: string
  // Phase-1 runtime/tool execution context.
  // NOTE: This contract must stay aligned with `@acta/tools`.
  cwd: string
  tempDir: string
  permissions: Array<'read_files' | 'write_files' | 'read_clipboard' | 'write_clipboard' | 'screen_capture' | 'network_access' | 'shell_execute'>
  logger?: (msg: string, meta?: any) => void

  // Legacy fields from early scaffolding (kept optional to avoid breaking older code paths)
  trustLevel?: 'low' | 'medium' | 'high'
  workingDir?: string
  dryRun?: boolean
  llm?: any
}

// CID:tool-types-006 - ToolResult
// Purpose: Standard output contract for tool executions
export interface ToolResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: string[]
  log?: string
}

// CID:tool-types-007 - Artifact
// Purpose: Describe artifact metadata produced by tools
export interface Artifact {
  path: string
  type: 'file' | 'directory' | 'url'
  metadata?: Record<string, any>
}

// CID:tool-types-008 - ActaTool
// Purpose: Interface for concrete tool implementations
export interface ActaTool {
  meta: ToolManifest
  execute(input: ToolInput, context: ToolContext): Promise<ToolResult>
}
