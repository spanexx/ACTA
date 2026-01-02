# Scoped Loggers

## Purpose
Context-aware logging for different components and operations.

## Logger Context
```ts
interface LoggerContext {
  component: string // e.g., 'agent', 'tool', 'ipc', 'trust'
  operation?: string // e.g., 'plan', 'execute', 'validate'
  userId?: string
  sessionId?: string
  profileId?: string
  taskId?: string
  requestId?: string
  tool?: string
  [key: string]: any // Additional context data
}
```

## Scoped Logger Interface
```ts
interface ScopedLogger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
  child(context: Partial<LoggerContext>): ScopedLogger
}
```

## Component-Specific Loggers

### Agent Logger
```ts
const agentLogger = createScopedLogger({
  component: 'agent',
  defaultContext: {
    sessionId: true,
    taskId: true,
    trustLevel: true
  }
})
```

### Tool Logger
```ts
const toolLogger = createScopedLogger({
  component: 'tool',
  defaultContext: {
    toolName: true,
    inputHash: true,
    duration: true,
    artifacts: true
  }
})
```

### IPC Logger
```ts
const ipcLogger = createScopedLogger({
  component: 'ipc',
  defaultContext: {
    requestId: true,
    source: true,
    messageType: true,
    profileId: true
  }
})
```

### Trust Logger
```ts
const trustLogger = createScopedLogger({
  component: 'trust',
  defaultContext: {
    tool: true,
    riskLevel: true,
    decision: true,
    rule: true
  }
})
```

### Runtime Logger
```ts
const runtimeLogger = createScopedLogger({
  component: 'runtime',
  defaultContext: {
    component: true,
    port: true,
    profileId: true
  uptime: true
  }
})
```

## Context Inheritance
Child loggers inherit context from parent:
```ts
const stepLogger = agentLogger.child({
  operation: 'execute',
  tool: 'file.read'
})

stepLogger.info('Reading file', {
  filePath: '/data/input.csv',
  size: 1024
})
```

## Log Message Examples
```ts
// Agent planning
agentLogger.info('Generated execution plan', {
  steps: 3,
  estimatedDuration: 5000,
  trustLevel: 'medium'
})

// Tool execution
toolLogger.info('File conversion completed', {
  tool: 'file.convert',
  inputFormat: 'csv',
  outputFormat: 'json',
  duration: 1234,
  artifacts: ['output.json']
})

// Permission decision
trustLogger.warn('Permission denied for file write', {
  tool: 'file.write',
  decision: 'deny',
  reason: 'User policy: no writes to /system'
})

// IPC message
ipcLogger.debug('Received task request', {
  messageType: 'task.request',
  source: 'ui',
  requestId: 'req_123'
})
```

## Performance Considerations
- **Context Caching**: Reuse logger instances to reduce overhead
- **Lazy Evaluation**: Only build context when logging is enabled
- **Structured Metadata**: Consistent key names across components
- **Async Logging**: Non-blocking log writes
- **Level Filtering**: Respect configured log levels per component

## Configuration
```ts
interface ScopedLoggerConfig {
  component: string
  level: LogLevel
  includeMetadata: boolean
  parentContext?: string[]
  childContext?: string[]
  outputFormat: 'json' | 'text'
}
```

## Best Practices
- **Descriptive Messages**: Clear what happened, not just "processing"
- **Structured Data**: Use objects for complex information
- **Consistent Keys**: Standard field names across components
- **Error Context**: Always include error details and stack traces
- **Privacy**: Never log sensitive user data or content
- **Performance**: Log timing for operations, not just start/end
