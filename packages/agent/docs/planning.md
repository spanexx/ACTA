# Agent Planning

## Purpose
Translate user intent into a structured, executable plan using the LLM.

## Planning Contract
- **Input**: User string + context
- **Output**: `AgentPlan` with steps
- **Constraints**: Must declare tools, mark risks
- **Guarantee**: No execution during planning

## LLM Prompt Structure
```
You are Acta.
You MUST:
- Produce a step-by-step plan
- Declare tool usage
- Mark risky steps
- Never execute actions

User: {input}
Context: {context}
```

## Expected Plan Schema
```json
{
  "goal": "Convert CSV to JSON",
  "steps": [
    {
      "id": "1",
      "tool": "file.read",
      "intent": "Read the CSV file",
      "input": { "path": "data.csv" },
      "requiresPermission": false
    },
    {
      "id": "2",
      "tool": "file.convert",
      "intent": "Convert CSV to JSON",
      "input": { "to": "json" },
      "requiresPermission": true
    }
  ],
  "risks": ["Overwrites existing file"]
}
```

## Step Requirements
- **id**: Unique string within plan
- **tool**: Must exist in Tool Registry
- **intent**: Human-readable description
- **input**: Valid input for the tool
- **requiresPermission**: Boolean for trust check

## Risk Assessment
- Tools with file writes → risky
- Network access → risky
- System changes → risky
- Read-only operations → safe

## Plan Validation Rules
- At least one step
- All tool names valid
- Step IDs unique
- Required fields present
- No prohibited actions

## Error Handling
- **Invalid schema**: Reject, ask LLM to fix
- **Unknown tool**: Reject, suggest alternatives
- **Too many steps**: Ask user to clarify
- **Ambiguous intent**: Ask for clarification

## Retry Logic
- Max 3 retries for invalid plans
- Progressive error feedback
- Fallback to simpler request
- Escalate to user if stuck

## Planning Strategies
- **Decomposition**: Break complex tasks
- **Verification**: Add confirmation steps
- **Rollback**: Include undo steps when possible
- **Safety**: Prefer read-only first

## Future Enhancements
- Multi-modal planning (images, audio)
- Parallel step execution
- Conditional branches
- Template-based plans
