# @acta/trust — Trust & Permission Engine

> Enforces everything you defined earlier. Non-negotiable.

## Purpose
- Define trust levels and permission scopes
- Evaluate tool requests against user policies
- Provide permission prompts for user approval
- Log all permission decisions for audit
- Enforce hard security boundaries

## Core Responsibilities
- **Trust Levels**: Low, medium, high with clear definitions
- **Permission Scopes**: Granular capability definitions
- **Rule Engine**: Policy evaluation and decision logic
- **Permission Prompts**: Clear user requests with risks
- **Profile Isolation**: Trust rules never cross profiles
- **Audit Logging**: All decisions and violations logged

## Expected Files (when fully implemented)
- `src/trust-engine.ts` — Core trust evaluation logic
- `src/rules.ts` — Permission rule definitions and storage
- `src/permissions.ts` — Permission scope definitions
- `src/prompts.ts` — User prompt templates
- `src/types.ts` — Trust-specific interfaces
- `src/index.ts` — Public exports

## Trust Levels
```ts
type TrustLevel = 'low' | 'medium' | 'high'
```

### Level Definitions
- **Low**: Read-only, explain, simulate
- **Medium**: Act with confirmation
- **High**: Act automatically within scope

### Default Behavior
- New profiles start at 'medium'
- Sensitive tools require explicit 'high' level
- System operations require 'high' level

## Permission Scopes
```ts
type PermissionScope =
  | 'read_files'
  | 'write_files'
  | 'read_clipboard'
  | 'write_clipboard'
  | 'screen_capture'
  | 'network_access'
  | 'shell_execute'
  | 'system_config'
```

### Scope Definitions
- **read_files**: Read file contents and metadata
- **write_files**: Create, modify, delete files
- **read_clipboard**: Access clipboard contents
- **write_clipboard**: Modify clipboard contents
- **screen_capture**: Take screenshots or read screen
- **network_access**: Make HTTP requests or internet access
- **shell_execute**: Run shell commands or scripts
- **system_config**: Modify Acta configuration

## Rule Engine
```ts
interface TrustRule {
  id: string
  name: string
  description: string
  scope: PermissionScope[]
  condition: RuleCondition
  action: RuleAction
  priority: number
  enabled: boolean
}

interface RuleCondition {
  type: 'tool_matches' | 'domain_matches' | 'trust_level_min' | 'always_allow' | 'always_deny'
  value: any
}

interface RuleAction {
  type: 'allow' | 'deny' | 'prompt' | 'log'
  parameters?: any
}
```

## Permission Request
```ts
interface PermissionRequest {
  id: string
  tool: string
  action: string
  reason: string
  risks: string[]
  reversible: boolean
  rememberDecision: boolean
  context?: any
  timestamp: number
  userId: string
  profileId: string
}
```

## Permission Decision
```ts
interface PermissionDecision {
  id: string
  requestId: string
  decision: 'allow' | 'deny' | 'allow_once'
  reason?: string
  timestamp: number
  userId: string
  profileId: string
  expiresAt?: number
  rule?: string
}
```

## Rule Examples
```ts
// Block dangerous tools
const dangerousToolsRule: TrustRule = {
  id: 'block-dangerous',
  name: 'Block Dangerous Tools',
  description: 'Prevent access to system-critical tools',
  scope: ['shell_execute', 'system_config'],
  condition: { type: 'tool_matches', value: ['kernel.*', 'system.*'] },
  action: { type: 'deny' },
  priority: 100,
  enabled: true
}

// Require confirmation for file writes
const fileWriteRule: TrustRule = {
  id: 'confirm-file-writes',
  name: 'Confirm File Writes',
  description: 'Always ask user before writing files',
  scope: ['write_files'],
  condition: { type: 'always_prompt' },
  action: { type: 'prompt' },
  priority: 50,
  enabled: true
}

// Allow read-only tools at low trust level
const readOnlyToolsRule: TrustRule = {
  id: 'allow-read-only-at-low',
  name: 'Allow Read-Only Tools at Low Trust',
  description: 'Allow file reading without confirmation at low trust level',
  scope: ['read_files', 'read_clipboard'],
  condition: { type: 'trust_level_min', value: 'low' },
  action: { type: 'allow' },
  priority: 30,
  enabled: true
}
```

## Permission Prompts
```ts
interface PermissionPrompt {
  title: string
  message: string
  risks: string[]
  options: PermissionOption[]
  tool?: string
  action?: string
  scope?: string[]
}

interface PermissionOption {
  label: string
  value: string
  description?: string
  style?: 'primary' | 'secondary' | 'danger'
}
```

## Prompt Templates
```ts
// File write permission
const fileWritePrompt: PermissionPrompt = {
  title: 'File Write Permission',
  message: 'Tool "{tool}" wants to {action} "{scope}". {reason}',
  risks: ['Will overwrite existing files', 'Can modify system behavior'],
  tool: 'file.write',
  action: 'write to',
  scope: '/Documents/Reports/output.xlsx',
  options: [
    { label: 'Allow Once', value: 'allow_once', style: 'primary' },
    { label: 'Deny', value: 'deny', style: 'danger' },
    { label: 'Always Allow', value: 'allow', style: 'secondary' }
  ]
}
```

## Configuration
```ts
interface TrustConfig {
  defaultLevel: TrustLevel
  autoApprove: Record<PermissionScope, boolean>
  blockedTools: string[]
  rules: TrustRule[]
  prompts: PermissionPrompt[]
  audit: {
    enabled: boolean
    retentionDays: number
    logLevel: 'info' | 'warn' | 'error'
  }
}
```

## Security Boundaries
- **No Silent Actions**: Every permission decision requires user input
- **No Bypass Mechanisms**: Rules cannot be overridden by tools
- **Complete Audit Trail**: All requests and decisions logged
- **Profile Isolation**: Trust rules never cross-contaminate
- **Rule Priority**: Hard blocks override auto-approvals
- **Time-Based Rules**: Temporary permissions with expiration

## Best Practices
- **Clear Scopes**: Permission requests must specify exact capabilities
- **Risk Assessment**: Always explain potential risks to users
- **Consistent Prompts**: Use standard language and formatting
- **Rule Testing**: Validate rules before deployment
- **User Education**: Help users understand trust implications
- **Fail-Safe Defaults**: Start with conservative permissions
