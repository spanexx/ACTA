# Audit Logging

## Purpose
Record all security-relevant and user-significant actions for compliance and debugging.

## Audit Events

### Permission Events
```ts
interface PermissionRequestEvent {
  type: 'permission.request'
  timestamp: number
  userId: string
  profileId: string
  data: {
    tool: string
    action: string
    reason: string
    risks: string[]
    reversible: boolean
  }
}

interface PermissionDecisionEvent {
  type: 'permission.decision'
  timestamp: number
  userId: string
  profileId: string
  data: {
    tool: string
    decision: 'allow' | 'deny' | 'allow_once'
    reason?: string
  }
}
```

### Tool Events
```ts
interface ToolExecuteEvent {
  type: 'tool.execute'
  timestamp: number
  userId: string
  profileId: string
  data: {
    tool: string
    input: any // Sanitized
    duration: number
    success: boolean
    error?: string
    artifacts?: string[]
  }
}

interface ToolResultEvent {
  type: 'tool.result'
  timestamp: number
  userId: string
  profileId: string
  data: {
    tool: string
    success: boolean
    output?: any
    artifacts?: string[]
    duration: number
  }
}
```

### Task Events
```ts
interface TaskStartEvent {
  type: 'task.start'
  timestamp: number
  userId: string
  profileId: string
  data: {
    taskId: string
    input: string // Sanitized
  trustLevel: string
  }
}

interface TaskCompleteEvent {
  type: 'task.complete'
  timestamp: number
  userId: string
  profileId: string
  data: {
    taskId: string
    steps: number
    duration: number
    summary: string
    success: boolean
  }
}
```

### System Events
```ts
interface SystemStartEvent {
  type: 'system.start'
  timestamp: number
  data: {
    component: string
    version: string
    port: number
  profileId?: string
  }
}

interface SystemErrorEvent {
  type: 'system.error'
  timestamp: number
  data: {
    component: string
    error: string
    stack?: string
    context?: any
  }
}
```

## Audit Storage
```ts
interface AuditStore {
  write(event: AuditEvent): Promise<void>
  query(filter: AuditFilter): Promise<AuditEvent[]>
  getRetentionPeriod(): number // days
  export(format: 'json' | 'csv'): Promise<string>
}
```

## Privacy & Sanitization
- **PII Redaction**: Remove emails, names, personal data
- **Path Sanitization**: Replace absolute paths with `<path>`
- **Content Filtering**: Remove binary data, large text blocks
- **Token Redaction**: Remove API keys, tokens from logs

## Retention Policy
- **Default**: 90 days for audit events
- **Security Events**: 365 days
- **System Logs**: 30 days
- **Configurable**: Per organization policy

## Query Interface
```ts
interface AuditFilter {
  userId?: string
  profileId?: string
  eventTypes?: AuditEvent['type'][]
  dateRange?: {
    start: Date
    end: Date
  }
  level?: 'info' | 'warn' | 'error'
  component?: string
  tool?: string
  limit?: number
  offset?: number
}
```

## Compliance Reporting
- **Daily Summaries**: Event counts by type and level
- **Weekly Reports**: User activity patterns
- **Monthly Reports**: Compliance dashboards
- **Export Formats**: JSON, CSV, PDF reports
- **Data Retention**: Automated cleanup per policy

## Security Features
- **Tamper Detection**: Cryptographic hashes for log integrity
- **Access Logging**: Who accessed audit logs and when
- **Change Tracking**: Configuration changes to audit logs
- **Alerting**: Real-time security event notifications
