# @acta/tools — Tool Registry & Execution

> Safe bridge between "thinking" and "doing". Plugin-ready.

## Purpose
- Register and manage tool capabilities
- Execute tools in controlled sandbox
- Provide tool metadata and manifests
- Enforce permission boundaries
- Enable plugin ecosystem without chaos

## Core Responsibilities
- **Tool Registry**: Central registry of all available tools
- **Tool Execution**: Sandboxed execution with resource limits
- **Manifest Validation**: Ensure tools declare capabilities and risks
- **Permission Integration**: Check permissions before execution
- **Plugin Loading**: Dynamic loading of external tools
- **Resource Management**: Track tool resource usage

## Expected Files (when fully implemented)
- `src/registry.ts` — Central tool registry
- `src/executor.ts` — Sandboxed tool execution
- `src/manifest.ts` — Tool manifest validation
- `src/sandbox.ts` — Execution sandbox implementation
- `src/loader.ts` — Plugin loading and discovery
- `src/types.ts` — Tool-specific interfaces
- `src/index.ts` — Public exports

## Tool Interface
```ts
interface ActaTool {
  meta: ToolManifest
  execute(input: any, context: ToolContext): Promise<ToolResult>
}
```

## Tool Manifest
```ts
interface ToolManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  entry: string // Path to main file
  capabilities: PermissionScope[]
  riskLevel: RiskLevel
  reversible: boolean
  ui: {
    showInActions: boolean
    icon: string
    category: string
    tags: string[]
  }
  dependencies?: string[]
  settings?: ToolSettings
}
```

## Tool Context
```ts
interface ToolContext {
  cwd: string
  tempDir: string
  permissions: PermissionScope[]
  trustLevel: TrustLevel
  logger: (msg: string) => void
  profileId: string
  sessionId?: string
  taskId?: string
  resources: {
    maxMemory: number
    maxCpu: number
    maxDuration: number
    allowedPaths: string[]
  }
}
```

## Tool Result
```ts
interface ToolResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: string[] // File paths created
  metadata?: {
    duration: number
    memoryUsage: number
    [key: string]: any
  }
}
```

## Risk Levels
```ts
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
```

### Level Definitions
- **Low**: Read-only operations, no system changes
- **Medium**: File modifications within user directories
- **High**: System changes, network access, sensitive operations
- **Critical**: Can compromise system security or data

## Phase-1 Tools
Core tools that will be available in Phase-1:
- **file.read**: Read file contents and metadata
- **file.write**: Create, modify, delete files
- **file.convert**: Convert between file formats
- **clipboard.read**: Read clipboard contents
- **clipboard.write**: Modify clipboard contents
- **explain.content**: Explain and analyze content

## Tool Settings
```ts
interface ToolSettings {
  timeout: number // Execution timeout in ms
  maxFileSize: number // Maximum file size in bytes
  allowedExtensions: string[] // Allowed file extensions
  memoryLimit: number // Memory limit in MB
  networkAccess: boolean // Allow network requests
  shellAccess: boolean // Allow shell command execution
}
```

## Plugin Interface
```ts
interface Plugin {
  manifest: ToolManifest
  instance: ActaTool
  load(): Promise<void>
  unload(): Promise<void>
  isLoaded(): boolean
}
```

## Sandbox Security
```ts
interface SandboxConfig {
  enabled: boolean
  type: 'docker' | 'vm' | 'chroot' | 'none'
  resourceLimits: {
    memory: number
    cpu: number
    disk: number
    network: boolean
  }
  allowedPaths: string[] // Whitelisted paths
  blockedPaths: string[] // Blacklisted paths
  environment: Record<string, string> // Restricted env vars
  timeout: number // Hard timeout
}
```

## Tool Categories
```ts
interface ToolCategory {
  id: string
  name: string
  description: string
  tools: string[]
}
```

### Phase-1 Categories
- **File Operations**: file.read, file.write, file.convert
- **Data Operations**: clipboard.read, clipboard.write
- **Analysis**: explain.content
- **System**: (empty in Phase-1)

## Registry Operations
```ts
interface ToolRegistry {
  register(tool: Plugin): Promise<void>
  unregister(toolId: string): Promise<void>
  list(filter?: ToolFilter): Promise<ToolInfo[]>
  get(toolId: string): Promise<Plugin>
  isRegistered(toolId: string): Promise<boolean>
  discover(path: string): Promise<Plugin[]>
}

interface ToolFilter {
  category?: string
  riskLevel?: RiskLevel
  capabilities?: PermissionScope[]
  author?: string
  enabled?: boolean
}
```

## Best Practices
- **Capability Declaration**: Tools must declare all capabilities
- **Risk Assessment**: Honest assessment of potential dangers
- **Resource Limits**: Enforce strict resource constraints
- **Permission Checks**: Always verify before execution
- **Sandboxing**: Execute tools in isolated environment
- **Error Handling**: Graceful failure with clear messages
- **Version Compatibility**: Semantic versioning and compatibility checks
- **Documentation**: Clear usage instructions and examples
