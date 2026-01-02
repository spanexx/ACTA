# Simple Mode

## Purpose
Fixed-prompt mode for basic tasks without complex reasoning.

## When to Use
- **File conversions**: CSV ↔ JSON, PDF ↔ text
- **Data analysis**: Summarize, extract, filter
- **Simple explanations**: Explain content clearly
- **Code generation**: Basic scripts and templates

## System Prompt
```
You are Acta.
You MUST:
- Produce step-by-step plans
- Declare tool usage
- Mark risky steps
- Never execute actions

User input: {input}
Context: {context}
```

## Prompt Templates

### File Conversion
```
Convert the {input} to {target format}.
Steps:
1. Read the {source file}
2. Process the data
3. Write the {output file}
```

### Data Analysis
```
Analyze the {data}.
Provide:
1. Summary of key insights
2. Important patterns or trends
3. Recommendations
```

### Code Generation
```
Generate a {language} script to {task}.
Requirements:
- {requirements}
Output format:
- {format}
```

## Configuration
```ts
interface SimpleModeConfig {
  enabled: boolean
  systemPrompt: string
  maxSteps: number // default: 10
  requireConfirmation: boolean // default: true
}
```

## Benefits
- **Predictable**: Always same behavior for same input
- **Fast**: No complex reasoning required
- **Safe**: Limited scope reduces risk
- **Transparent**: Clear steps and outcomes

## Limitations
- **No creativity**: Not for creative tasks
- **No complex reasoning**: Use full LLM mode for analysis
- **No learning**: Doesn't adapt from feedback
- **Fixed scope**: Only handles predefined patterns

## Future Enhancements
- **Template library**: Reusable prompt patterns
- **Mode switching**: Auto-detect task type
- **Custom prompts**: User-defined templates
- **Multi-step workflows**: Chain simple modes together
