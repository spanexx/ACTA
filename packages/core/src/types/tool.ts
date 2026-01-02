// Core tool types shared across packages
// These types define the contract for tool manifests, execution, and results

export type RiskLevel = 'low' | 'medium' | 'high'

export interface ToolPermissions {
  read: boolean
  write: boolean
  execute: boolean
}

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

export interface ToolInput {
  [key: string]: any
}

export interface ToolContext {
  profileId: string
  trustLevel: 'low' | 'medium' | 'high'
  workingDir: string
  dryRun: boolean
  llm?: any
  logger?: (msg: string) => void
}

export interface ToolResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: string[]
  log?: string
}

export interface Artifact {
  path: string
  type: 'file' | 'directory' | 'url'
  metadata?: Record<string, any>
}

export interface ActaTool {
  meta: ToolManifest
  execute(input: ToolInput, context: ToolContext): Promise<ToolResult>
}
