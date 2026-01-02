# @acta/memory — Memory Core

> Give Acta continuity without creepiness. Session-first, local-only.

## Purpose
- Provide short-term task memory for agent continuity
- Enable explicit long-term memory management (opt-in)
- Ensure memory is searchable and inspectable
- Maintain session isolation between profiles

## Core Responsibilities
- **Session Memory**: Store task context, recent actions, and intermediate results
- **Long-term Memory**: Persistent knowledge storage (Phase-2+)
- **Memory Interface**: Unified API for different storage backends
- **Search & Retrieval**: Find relevant memories for context
- **Privacy Controls**: User control over what gets stored

## Expected Files (when fully implemented)
- `src/memory-store.ts` — In-memory session storage
- `src/long-term.ts` — Persistent memory interface (Phase-2+)
- `src/search.ts` — Memory search and retrieval
- `src/types.ts` — Memory-specific interfaces
- `src/index.ts` — Public exports

## Memory Interface
```ts
interface MemoryStore {
  add(key: string, value: any, options?: MemoryOptions): Promise<void>
  get(key: string): Promise<any>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  list(prefix?: string): Promise<MemoryEntry[]>
  search(query: string, options?: SearchOptions): Promise<MemoryEntry[]>
}
```

## Memory Entry
```ts
interface MemoryEntry {
  key: string
  value: any
  timestamp: number
  expiresAt?: number
  metadata?: {
    source: 'user' | 'agent' | 'tool'
    type: 'task' | 'plan' | 'result' | 'error'
    sessionId?: string
    taskId?: string
    tool?: string
    [key: string]: any
  }
}
```

## Session Memory
```ts
interface SessionMemory {
  // Task context
  setTaskContext(taskId: string, context: any): Promise<void>
  getTaskContext(taskId: string): Promise<any>
  
  // Recent actions
  addAction(action: MemoryAction): Promise<void>
  getRecentActions(limit?: number): Promise<MemoryAction[]>
  
  // Conversation history
  addMessage(role: 'user' | 'agent', content: string): Promise<void>
  getMessages(limit?: number): Promise<MemoryMessage[]>
  
  // Tool results
  setToolResult(tool: string, result: ToolResult): Promise<void>
  getToolResults(tool?: string): Promise<ToolResult[]>
}
```

## Memory Actions
```ts
interface MemoryAction {
  type: 'step' | 'plan' | 'result' | 'permission' | 'error'
  description: string
  timestamp: number
  data?: any
  metadata?: {
    tool?: string
    stepId?: string
    duration?: number
    success?: boolean
  }
}
```

## Memory Messages
```ts
interface MemoryMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: number
  metadata?: {
    taskId?: string
    stepId?: string
  [key: string]: any
  }
}
```

## Search Options
```ts
interface SearchOptions {
  limit?: number
  type?: 'exact' | 'fuzzy' | 'semantic'
  dateRange?: {
    start: Date
    end: Date
  }
  includeMetadata?: string[]
  excludeMetadata?: string[]
}
```

## Configuration
```ts
interface MemoryConfig {
  maxSize: number // Maximum memory size in bytes
  ttl: number // Default TTL in seconds
  maxEntries: number // Maximum number of entries
  persistence: {
    enabled: boolean
    path: string
    format: 'json' | 'binary'
  }
  privacy: {
    retentionDays: number
    anonymize: boolean
    userControl: boolean
  }
}
```

## Storage Backends
### Phase-1: In-Memory
- Volatile session storage
- Fast access for agent continuity
- Automatic cleanup on session end
- No persistence required

### Phase-2+: Persistent Storage
- File-based storage with indexing
- Database integration (SQLite, PostgreSQL)
- Vector embeddings for semantic search
- Cross-session memory retention

## Privacy & Security
- **User Control**: Explicit consent for memory storage
- **Data Minimization**: Store only necessary information
- **Encryption**: Optional encryption for sensitive memories
- **Access Control**: Memory isolation per profile
- **Right to Deletion**: Complete memory removal on request
- **Audit Logging**: All memory access logged

## Search Capabilities
- **Exact Match**: Find entries with exact key/value
- **Fuzzy Search**: Approximate string matching
- **Semantic Search**: Find conceptually related memories
- **Temporal Queries**: Find memories from time ranges
- **Faceted Search**: Filter by metadata fields

## Best Practices
- **Structured Keys**: Consistent naming conventions
- **Metadata Richness**: Store context for better retrieval
- **Expiration**: Automatic cleanup of old entries
- **Indexing**: Optimize for common query patterns
- **Privacy First**: Default to not storing unless explicitly requested
