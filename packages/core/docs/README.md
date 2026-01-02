# @acta/core — Core Runtime Foundation

> The always-on local engine that runs Acta, manages state, talks to models, executes tools, and enforces trust.

## Purpose
- Provide the foundational runtime host
- Manage configuration and lifecycle
- Expose shared types and utilities
- Coordinate all other packages

## Core Responsibilities
- **Runtime Host**: Background daemon, survives UI open/close
- **Profile Management**: Multi-user, multi-profile support with isolation
- **Configuration**: Hierarchical config loading (defaults → env → runtime)
- **Shared Types**: Common interfaces used across packages
- **Utilities**: Helper functions and constants

## Expected Files (when fully implemented)
- `src/runtime.ts` — Runtime host lifecycle and process management
- `src/profiles.ts` — User/profile manager with isolation
- `src/config.ts` — Configuration loader and provider (partially implemented)
- `src/types.ts` — Shared TypeScript interfaces
- `src/constants.ts` — System constants and enums
- `src/utils.ts` — Common utility functions
- `src/index.ts` — Public exports

## Behavior (when fully implemented)
- Starts on OS boot (optional)
- Exposes local IPC/API
- Manages processes (LLM, plugins, tools)
- Maintains session state per user profile
- Enforces profile isolation (memory, permissions, trust rules, plugins)
- Provides configuration to all other packages

## Boundaries
- ❌ No UI rendering
- ❌ No direct OS actions
- ❌ No agent logic (delegated to @acta/agent)
- ❌ No tool execution (delegated to @acta/tools)

## Phase-1 Success Criteria
- Acta can run headless
- Multiple profiles work
- Configuration is hierarchical and validated
- Shared types are consistent
- Runtime starts/stops cleanly

## Standards
- Local-first by default
- Profile isolation enforced
- Configuration over environment where possible
- Human-readable logs
- Transparent data structures

## Future Extensibility
- OS boot integration
- Process monitoring
- Resource quotas
- Health monitoring
