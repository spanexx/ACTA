# Permission Prompts

## Purpose
User-facing permission request templates that clearly explain risks and provide options.

## Prompt Structure
```ts
interface PermissionPrompt {
  id: string
  title: string
  message: string
  description?: string
  risks: string[]
  options: PermissionOption[]
  tool?: string
  action?: string
  scope?: string[]
  metadata?: Record<string, any>
}
```

## Prompt Templates

### File Write Permission
```ts
const fileWritePrompt: PermissionPrompt = {
  id: 'file-write-permission',
  title: 'File Write Permission',
  message: 'Tool "{tool}" wants to {action} "{scope}". {reason}',
  description: 'A tool is requesting permission to write or modify files',
  risks: [
    'Will overwrite existing files',
    'Can modify system behavior',
    'May expose sensitive information'
  ],
  options: [
    { label: 'Allow Once', value: 'allow_once', style: 'primary' },
    { label: 'Deny', value: 'deny', style: 'danger' },
    { label: 'Always Allow', value: 'allow', style: 'secondary' }
  ],
  tool: 'file.write',
  action: 'write to',
  scope: '/Documents/Reports/output.xlsx'
}
```

### Network Access Permission
```ts
const networkAccessPrompt: PermissionPrompt = {
  id: 'network-access-permission',
  title: 'Network Access Permission',
  message: 'Tool "{tool}" wants to access {scope}',
  description: 'A tool is requesting permission to access the network or external services',
  risks: [
    'May contact external servers',
    'Could expose data to third parties',
    'Security implications beyond local control'
  ],
  options: [
    { label: 'Allow Once', value: 'allow_once', style: 'primary' },
    { label: 'Deny', value: 'deny', style: 'danger' },
    { label: 'Restrict Domain', value: 'restrict_domain', style: 'secondary' }
  ],
  tool: 'network.client',
  action: 'access',
  scope: 'api.openai.com',
  metadata: { domainRestriction: true }
}
```

### System Configuration Permission
```ts
const systemConfigPrompt: PermissionPrompt = {
  id: 'system-config-permission',
  title: 'System Configuration Permission',
  message: 'Tool "{tool}" wants to modify Acta configuration',
  description: 'A tool is requesting permission to change system settings',
  risks: [
    'Could affect system stability',
    'May compromise security settings',
    'Could impact all users'
  ],
  options: [
    { label: 'Allow', value: 'allow', style: 'primary' },
    { label: 'Review Settings', value: 'review', style: 'secondary' }
  ],
  tool: 'system.config',
  action: 'modify',
  scope: 'trust.level'
}
```

### Screen Capture Permission
```ts
const screenCapturePrompt: PermissionPrompt = {
  id: 'screen-capture-permission',
  title: 'Screen Capture Permission',
  message: 'Tool "{tool}" wants to {action} the screen',
  description: 'A tool is requesting permission to capture screen contents',
  risks: [
    'Privacy implications',
    'Could capture sensitive information',
    'May record user interactions'
  ],
  options: [
    { label: 'Allow Once', value: 'allow_once', style: 'primary' },
    { label: 'Deny', value: 'deny', style: 'danger' },
    { label: 'Region Only', value: 'restrict_region', style: 'secondary' }
  ],
  tool: 'screen.capture',
  action: 'capture',
  scope: 'current_window'
}
```

### Shell Execute Permission
```ts
const shellExecutePrompt: PermissionPrompt = {
  id: 'shell-execute-permission',
  title: 'Shell Command Permission',
  message: 'Tool "{tool}" wants to execute shell command: "{command}"',
  description: 'A tool is requesting permission to execute shell commands',
  risks: [
    'Could modify system files',
    'Could install malware',
    'May bypass security controls',
    'Could access sensitive data'
  ],
  options: [
    { label: 'Cancel', value: 'cancel', style: 'danger' },
    { label: 'Review Command', value: 'review', style: 'secondary' }
  ],
  tool: 'shell.execute',
  action: 'execute',
  scope: 'command',
  metadata: { command: 'rm -rf /' }
}
```

## Custom Prompt Variables
Prompts can include variables that are dynamically replaced:
- `{tool}` - Tool name requesting permission
- `{action}` - Action being requested
- `{scope}` - Resource or scope being affected
- `{reason}` - Why the tool needs permission
- `{risks}` - Array of risk descriptions
- `{user}` - Current user or profile name
- `{profile}` - Current profile name

## Prompt Localization
```ts
interface PromptLocalization {
  title: string
  message: string
  options: PermissionOption[]
  risks: string[]
}

const localizedPrompts: Record<string, PromptLocalization> = {
  en: fileWritePrompt,
  es: {
    title: 'Permiso de Escritura de Archivo',
    message: 'La herramienta "{tool}" quiere {action} "{scope}". {reason}',
    // ... localized options and risks
  }
}
```

## Prompt Best Practices
- **Clear Language**: Use simple, non-technical language
- **Specific Scopes**: Always specify exact files or paths
- **Risk Explanation**: Be honest about potential downsides
- **Consistent Options**: Use standard option labels and styles
- **Action-Oriented**: Focus on what will happen, not just permission
- **Context Awareness**: Include relevant context in prompts
- **Privacy First**: Never include sensitive information in prompts

## Dynamic Prompts
```ts
function generatePrompt(template: PermissionPrompt, context: any): PermissionPrompt {
  return {
    ...template,
    message: template.message
      .replace(/\{(\w+)\}/g, (match, key) => context[key] || match)
      .replace('{reason}', context.reason || 'No reason provided')
      .replace('{tool}', context.tool || 'Unknown tool')
      .replace('{action}', context.action || 'perform action')
      .replace('{scope}', context.scope || 'unspecified scope')
  }
}
```

## UI Integration
```ts
interface PromptRenderer {
  render(prompt: PermissionPrompt): Promise<PermissionPromptUI>
  show(prompt: PermissionPromptUI): Promise<PermissionDecision>
}

interface PermissionPromptUI {
  title: string
  message: string
  description?: string
  risks: string[]
  options: PermissionOptionUI[]
  tool?: string
  action?: string
  scope?: string
  metadata?: Record<string, any>
}

interface PermissionOptionUI {
  label: string
  value: string
  description?: string
  style: 'primary' | 'secondary' | 'danger'
  icon?: string
  shortcut?: string
}
```

## Prompt Analytics
```ts
interface PromptAnalytics {
  trackDecision(decision: PermissionDecision): void
  trackPromptView(prompt: PermissionPrompt, duration: number): void
  trackResponseTime(prompt: PermissionPrompt, responseTime: number): void
  getConversionRate(): Promise<number>
  getCommonDenials(): Promise<string[]>
}
```

## Security Considerations
- **No Injection**: Never include user input directly in prompts
- **Input Validation**: Validate all template variables
- **Rate Limiting**: Prevent prompt flooding attacks
- **Audit Trail**: Log all prompt displays and decisions
- **Privacy**: Never log sensitive user data in prompts
- **Consistency**: Use approved prompt templates only
