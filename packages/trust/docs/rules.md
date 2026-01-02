# Trust Rules

## Purpose
Define and manage permission rules that govern tool access and user interactions.

## Rule Types

### Hard Block Rules
Always deny access, regardless of trust level or user preference.
```ts
interface BlockRule extends TrustRule {
  condition: { type: 'always_deny' }
  action: { type: 'deny' }
  priority: 100 // Maximum priority
}
```

### Conditional Allow Rules
Allow access based on conditions like trust level, domain, or time.
```ts
interface ConditionalRule extends TrustRule {
  condition: RuleCondition
  action: { type: 'allow' }
  priority: number // 1-99
}
```

### Prompt Rules
Always ask user permission, regardless of other factors.
```ts
interface PromptRule extends TrustRule {
  condition: { type: 'always_prompt' }
  action: { type: 'prompt' }
  priority: number // 1-99
}
```

### Time-Based Rules
Rules that apply only during specific time periods.
```ts
interface TimeBasedRule extends TrustRule {
  condition: {
    type: 'time_range',
    start: string, // HH:mm
    end: string,   // HH:mm
    days?: string[] // Days of week
  }
  action: { type: 'allow' | 'deny' }
  priority: number
}
```

## Rule Conditions

### Tool Matching
```ts
interface ToolMatchCondition {
  type: 'tool_matches'
  value: string | string[] // Tool name or pattern
  negate?: boolean // Invert the match
}
```

### Domain Matching
```ts
interface DomainMatchCondition {
  type: 'domain_matches'
  value: string | string[] // Domain or pattern
  negate?: boolean // Invert the match
}
```

### Trust Level Conditions
```ts
interface TrustLevelCondition {
  type: 'trust_level_min' | 'trust_level_max' | 'trust_level_exact'
  value: TrustLevel
}
```

### Time Range Condition
```ts
interface TimeRangeCondition {
  type: 'time_range'
  start: string // HH:mm 24-hour format
  end: string   // HH:mm 24-hour format
  days?: string[] // Days of week: ['mon', 'tue', etc.]
  timezone?: string // IANA timezone identifier
}
```

### Always Allow/Deny
```ts
interface AlwaysCondition {
  type: 'always_allow' | 'always_deny'
}
```

## Rule Examples

### Block System Tools
```ts
const blockSystemTools: BlockRule = {
  id: 'block-system-tools',
  name: 'Block System Tools',
  description: 'Prevent access to system-critical tools',
  scope: ['shell_execute', 'system_config'],
  condition: { type: 'tool_matches', value: ['kernel.*', 'system.*'] },
  action: { type: 'deny' },
  priority: 100,
  enabled: true
}
```

### Allow File Reads at Low Trust
```ts
const allowFileReadsAtLow: ConditionalRule = {
  id: 'allow-file-reads-low',
  name: 'Allow File Reads at Low Trust',
  description: 'Allow file reading without confirmation at low trust level',
  scope: ['read_files'],
  condition: { type: 'trust_level_min', value: 'low' },
  action: { type: 'allow' },
  priority: 30,
  enabled: true
}
```

### Prompt for Network Access
```ts
const promptForNetworkAccess: PromptRule = {
  id: 'prompt-network-access',
  name: 'Prompt for Network Access',
  description: 'Always ask user before allowing network access',
  scope: ['network_access'],
  condition: { type: 'always_prompt' },
  action: { type: 'prompt' },
  priority: 90,
  enabled: true
}
```

### Business Hours Only
```ts
const businessHoursOnly: TimeBasedRule = {
  id: 'business-hours-only',
  name: 'Business Hours Only',
  description: 'Allow actions only during business hours',
  condition: {
    type: 'time_range',
    start: '09:00',
    end: '17:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri']
  },
  action: { type: 'allow' },
  priority: 50,
  enabled: false // Disabled by default
}
```

## Rule Storage
```ts
interface RuleStore {
  save(rule: TrustRule): Promise<void>
  delete(ruleId: string): Promise<void>
  list(filter?: RuleFilter): Promise<TrustRule[]>
  enable(ruleId: string): Promise<void>
  disable(ruleId: string): Promise<void>
  getActive(): Promise<TrustRule[]>
}

interface RuleFilter {
  type?: Rule['type']
  scope?: PermissionScope[]
  enabled?: boolean
  priority?: number
}
```

## Rule Evaluation Order
1. **Hard Blocks** (priority 100) - Always applied first
2. **Time-Based Rules** (priority 90-99) - Applied if time matches
3. **Prompt Rules** (priority 80-89) - Applied if no other rule matches
4. **Conditional Allows** (priority 1-79) - Applied if conditions match
5. **Default Deny** - If no rule matches, deny

## Rule Conflicts
- **Priority Resolution**: Higher priority wins
- **Specificity**: More specific rules override general ones
- **First Match**: First matching rule wins
- **Rule Inheritance**: Child profiles inherit from parent

## Rule Testing
```ts
interface RuleTestCase {
  name: string
  context: {
    tool: string
    userProfile: TrustProfile
    request: PermissionRequest
  }
  expected: PermissionDecision
  actual?: PermissionDecision
}
```

## Best Practices
- **Principle of Least Privilege**: Start with most restrictive rules
- **Clear Documentation**: Every rule must have clear purpose and examples
- **Regular Review**: Audit rules for effectiveness and fairness
- **User Communication**: Explain why permissions are denied or granted
- **Fail-Safe Defaults**: When in doubt, deny access
- **Performance**: Optimize rule evaluation for low overhead
