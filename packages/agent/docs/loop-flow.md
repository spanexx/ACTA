# Agent Loop Flow Reference

## 1. Entry Point: handleTask
```ts
async handleTask(request: TaskRequest): Promise<void>
```
- Generates unique `taskId`
- Emits `task.request` event
- Begins orchestration

## 2. Context Building
```ts
async buildContext(request: TaskRequest): Promise<AgentContext>
```
Collects:
- User input string
- File list from `request.context?.files`
- Clipboard content (if requested)
- Session memory (read-only)
- Current trust level

## 3. Planning Phase
```ts
async planTask(input: string, context: AgentContext): Promise<AgentPlan>
```
- Sends structured prompt to LLM
- Enforces plan schema (goal + steps)
- Requires tool declarations
- Marks risky steps (`requiresPermission`)

### LLM Prompt Template
```
You are Acta.
You MUST:
- Produce a step-by-step plan
- Declare tool usage
- Mark risky steps
- Never execute actions
```

## 4. Plan Validation
```ts
validatePlan(plan: AgentPlan): boolean
```
Checks:
- At least one step
- Valid tool names
- Required fields present
- No prohibited actions

## 5. Trust Evaluation (per step)
```ts
async evaluate(step: AgentStep): Promise<boolean>
```
Logic:
- If tool blocked → deny
- If no permission required → allow
- If auto-approved → allow
- Else → prompt user via UI

## 6. Step Execution
```ts
async executeStep(step: AgentStep): Promise<ToolResult>
```
- Looks up tool in Registry
- Calls `tool.execute(input, context)`
- Never calls OS directly
- Returns success/failure + artifacts

## 7. Observation
```ts
observe(step: AgentStep, result: ToolResult): void
```
- Adds to session memory
- Notifies UI of artifacts
- Logs outcome

## 8. Final Summarization
```ts
async summarize(plan: AgentPlan): Promise<string>
```
- Sends plan and outcomes to LLM
- Returns human-readable summary
- Emits `task.result`

## Event Emission Timeline
```
task.request → task.plan → task.step (N times) → task.result OR task.error
```

## Error Handling
- Tool not found → error, stop
- Permission denied → error, stop
- Tool failure → error, stop
- Invalid plan → error, stop
