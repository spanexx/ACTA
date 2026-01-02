# Step Execution

## Purpose
Safely execute each planned step through the Tool Registry with trust enforcement.

## Execution Flow
```ts
async executeStep(step: AgentStep): Promise<ToolResult>
```

## Process
1. **Tool Lookup**: Verify tool exists in Registry
2. **Trust Check**: Already done in loop, but double-check
3. **Context Preparation**: Build tool execution context
4. **Dispatch**: Call `tool.execute(input, context)`
5. **Result Handling**: Parse success/failure + artifacts
6. **Observation**: Log outcome and artifacts

## Tool Context
```ts
interface ToolContext {
  cwd: string
  tempDir: string
  permissions: string[]
  trustLevel: 'low' | 'medium' | 'high'
  logger: (msg: string) => void
}
```

## Safety Boundaries
- **No OS access** except via tools
- **No shell execution**
- **No filesystem** beyond allowed directories
- **No network** unless tool explicitly allows
- **Timeouts** enforced per tool

## Error Handling
- **Tool not found**: Fail immediately
- **Tool crash**: Capture error, stop plan
- **Timeout**: Kill tool, report failure
- **Permission error**: Should not happen (checked earlier)

## Result Types
```ts
interface ToolResult {
  success: boolean
  output?: any
  error?: string
  artifacts?: string[] // file paths created
}
```

## Artifact Handling
- Collect file paths from result
- Validate paths are within allowed directories
- Notify UI of new artifacts
- Store in session memory

## Logging
- Step start/end timestamps
- Tool name and input hash
- Success/failure status
- Artifacts created
- Error messages

## Performance
- Parallel execution for independent steps (future)
- Resource limits per step
- Memory usage tracking
- Timeout enforcement

## Future Enhancements
- Parallel step execution
- Rollback capabilities
- Progress reporting
- Resource quotas
