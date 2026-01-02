# @acta/logging — Event & Logging System

> Trust through visibility. Human-readable, inspectable logs.

## Purpose
- Provide structured logging for all Acta components
- Enable audit trails for security and debugging
- Offer log inspection in UI
- Ensure no silent actions

## Core Responsibilities
- **Structured Logging**: Consistent log format across all packages
- **Log Levels**: Debug, info, warn, error with configurable filtering
- **Scoped Loggers**: Component-specific loggers with context
- **Audit Trail**: Record all significant actions (permissions, tool usage, errors)
- **Performance Metrics**: Optional timing and resource usage tracking

## Expected Files (when fully implemented)
- `src/logger.ts` — Main logger factory and configuration
- `src/scoped-logger.ts` — Context-aware logger implementation
- `src/audit.ts` — Audit trail for security events
- `src/formatters.ts` — Log output formatters (JSON, text, structured)
- `src/types.ts` — Logging-specific interfaces
- `src/index.ts` — Public exports

## Log Levels
```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
```

### Level Descriptions
- **debug**: Detailed debugging information, development only
- **info**: General information about normal operation
- **warn**: Unexpected behavior that doesn't stop execution
- **error**: Errors that prevent normal operation

## Logger Interface
```ts
interface Logger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
  child(context: string): Logger
}
```

## Scoped Logger
```ts
interface ScopedLogger extends Logger {
  context: string // Component or operation identifier
  userId?: string // For user-specific actions
  sessionId?: string // For task-specific tracking
  profileId?: string // For profile isolation
}
```

## Log Format
```ts
interface LogEntry {
  timestamp: number // Unix ms
  level: LogLevel
  context: string
  message: string
  meta?: {
    userId?: string
    sessionId?: string
    profileId?: string
    component?: string
    action?: string
    duration?: number
    error?: Error
    [key: string]: any
  }
}
```

## Configuration
```ts
interface LoggingConfig {
  level: LogLevel
  format: 'json' | 'text' | 'structured'
  maxFileSize: string // e.g., '10m'
  maxFiles: number
  output: 'console' | 'file' | 'both'
  includeMetadata: boolean
}
```

## Audit Events
```ts
type AuditEvent =
  | 'permission.request'
  | 'permission.decision'
  | 'tool.execute'
  | 'tool.result'
  | 'task.start'
  | 'task.complete'
  | 'system.start'
  | 'system.error'
```

## Performance Metrics
```ts
interface PerformanceMetrics {
  operationCount: number
  averageDuration: number
  errorRate: number
  memoryUsage: NodeJS.MemoryUsage
  timestamp: number
}
```

## Security Considerations
- **No sensitive data**: Never log passwords, API keys, personal content
- **Sanitization**: Remove file paths, user data from logs
- **Access Control**: Log file permissions (600 or 600)
- **Rotation**: Automatic log rotation to prevent disk fill
- **Integrity**: Optional log signing for tamper detection

## Standards
- **JSON Structure**: Consistent field names and types
- **Timestamp Format**: Unix milliseconds in UTC
- **Error Format**: Stack traces with context
- **Component Context**: Always include which component generated the log
- **User Privacy**: PII redaction and anonymization

## Future Enhancements
- **Log Streaming**: Real-time log streaming to UI
- **Log Querying**: Advanced search and filtering
- **Metrics Dashboard**: Performance visualization
- **Compliance**: GDPR/SOC2 reporting features
- **Remote Logging**: Optional log aggregation service
