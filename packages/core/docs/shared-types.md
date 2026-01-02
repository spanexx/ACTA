# Shared Types & Interfaces

## Purpose
Provide common TypeScript interfaces used across all Acta packages.

## Core Types

### Entity Identifiers
```ts
type ProfileId = string
type TaskId = string
StepId = string
ToolId = string
MemoryId = string
```

### Trust Levels
```ts
type TrustLevel = 'low' | 'medium' | 'high'
```

### Permission Scopes
```ts
type PermissionScope =
  | 'read_files'
  | 'write_files'
  | 'read_clipboard'
  | 'write_clipboard'
  | 'screen_capture'
  | 'network_access'
  | 'shell_execute'
```

### Risk Levels
```ts
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
```

## Status Types

### Task Status
```ts
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
```

### Component Status
```ts
type ComponentStatus = 'starting' | 'ready' | 'stopping' | 'error' | 'offline'
```

## Result Types

### Operation Result
```ts
interface OperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
}
```

### Paginated Result
```ts
interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
```

## Configuration Types

### Provider Config
```ts
interface ProviderConfig {
  enabled: boolean
  priority: number
  settings: Record<string, any>
}
```

### Logging Config
```ts
interface LoggingConfig {
  level: LogLevel
  maxFileSize: string
  maxFiles: number
  format: 'json' | 'text'
}
```

## Event Types

### System Event
```ts
interface SystemEvent {
  type: string
  timestamp: number
  source: string
  data: any
}
```

### Lifecycle Event
```ts
interface LifecycleEvent {
  component: string
  status: ComponentStatus
  message?: string
}
```

## Utility Types

### Deep Partial
```ts
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
```

### RequiredFields
```ts
type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
```
