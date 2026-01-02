# @acta/agent — Agent Loop & Orchestration

> Lives inside Acta Core Runtime. UI never bypasses it.

## Purpose
- Translate user intent into safe, executable plans
- Coordinate LLM, tools, trust, and memory
- Enforce strict execution boundaries
- Provide transparent, auditable behavior

## Core Loop Flow
```
User Input → Context Gathering → Planning (LLM) → Permission Check → Step Execution → Observation → Final Response
```

## Key Responsibilities
- **Context building**: Gather files, clipboard, session memory
- **Planning**: Ask LLM to produce step-by-step `AgentPlan`
- **Validation**: Ensure plan is safe and valid
- **Trust evaluation**: Check permissions before each step
- **Tool execution**: Dispatch to Tool Registry only
- **Observation**: Log outcomes and artifacts
- **Summarization**: Produce final response via LLM

## Expected Files (when fully implemented)
- `src/agent.ts` — Main `ActaAgent` class with loop logic
- `src/context.ts` — Context builder from request + environment
- `src/planner.ts` — LLM prompt templates and plan parsing
- `src/executor.ts` — Step execution with tool dispatch
- `src/observer.ts` — Memory logging and artifact tracking
- `src/validator.ts` — Plan validation and safety checks
- `src/types.ts` — Agent-specific interfaces
- `src/index.ts` — Public exports

## Behavior (when fully implemented)
- Receives `TaskRequest` via IPC
- Emits lifecycle events (`task.plan`, `task.step`, `task.result`, `task.error`)
- Never touches OS directly
- Never runs shell commands
- All tool access via Tool Registry
- Respects trust level and permissions
- Stops immediately on permission denial or tool failure

## Failure Modes
- **Tool crash**: Stop plan, explain error
- **Permission denied**: Stop, wait for user
- **LLM bad plan**: Reject and re-plan
- **Timeout**: Abort safely

## Standards
- Deterministic, inspectable flow
- Trust-aware at every step
- Plugin-safe boundaries
- UI-friendly event emission
- Local-first design

## Future Extensibility
- Autonomous mode (Phase-2)
- Background agents (Phase-2)
- Multi-agent coordination (Phase-3)
