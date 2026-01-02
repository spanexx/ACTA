# Context Builder

## Purpose
Gather all information the agent needs to make informed decisions without breaching privacy or trust.

## Input Sources
- **User request**: Primary input string
- **File list**: Explicitly provided file paths
- **Clipboard**: Only if `request.context?.clipboard` is true
- **Session memory**: Short-term memory from current session
- **Trust level**: Current profile trust level

## Context Shape
```ts
interface AgentContext {
  input: string
  files: string[]
  clipboard: string | null
  memory: SessionMemory
  trustLevel: 'low' | 'medium' | 'high'
}
```

## Privacy Rules
- **No screen reading** unless explicitly requested
- **No filesystem scanning** beyond provided files
- **Memory is read-only** during planning
- **Clipboard access** only with user consent

## Building Process
```ts
async buildContext(request: TaskRequest): Promise<AgentContext> {
  return {
    input: request.input,
    files: request.context?.files ?? [],
    clipboard: request.context?.clipboard
      ? await this.tools.clipboard.read()
      : null,
    memory: this.memory.getSession(),
    trustLevel: request.trustLevel ?? 'low'
  }
}
```

## File Handling
- Paths are validated and normalized
- File existence checked
- Size limits enforced
- Binary files flagged for special handling

## Clipboard Handling
- Accessed only if user opts in
- Content sanitized
- Size limits (1MB default)
- Image handling (future)

## Memory Integration
- Session memory includes recent steps
- No long-term memory access in Phase-1
- Memory is read-only during planning
- Used to avoid repeating actions

## Trust Level Impact
- **Low**: Read-only, explain, simulate
- **Medium**: Act with confirmation
- **High**: Act automatically within scope

## Future Enhancements
- Screen capture integration
- Long-term memory queries
- External data sources (web)
- Real-time collaboration context
