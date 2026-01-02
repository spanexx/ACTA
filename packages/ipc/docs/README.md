# @acta/ipc — Inter-Process Communication

> The **only way** UI, plugins, or external tools talk to the runtime.

## Purpose
- Enforce secure, auditable communication boundaries
- Provide schema-validated JSON messaging
- Support local-only transports (Unix socket, HTTP)
- Isolate plugins from core runtime

## Transport Options (Phase-2)
- **Unix socket / named pipe** (preferred for security)
- **Local HTTP** (`127.0.0.1`) (fallback)
- Messages are always JSON
- All messages are schema-validated

## Core Message Shape
```json
{
  "id": "msg_123",
  "type": "task.request",
  "source": "ui",
  "timestamp": 1640995200000,
  "payload": { ... }
}
```

## Key Message Types
- **Commands (UI → Runtime)**: `task.request`, `permission.respond`, `memory.update`, `plugin.install`
- **Events (Runtime → UI)**: `task.plan`, `permission.request`, `task.step`, `task.complete`, `error`

## Security Rules
- No wildcard commands
- No raw shell calls
- Filesystem paths normalized
- Rate limiting per source
- Invalid messages rejected silently + logged

## Plugin Restrictions
- Limited IPC namespace
- No direct agent control
- Tool execution only via registry

## Expected Files (when fully implemented)
- `src/types.ts` — All IPC interfaces and message schemas
- `src/validator.ts` — Runtime type guards and schema validation (Zod)
- `src/adapter.ts` — Transport adapters (HTTP, Unix socket)
- `src/server.ts` — IPC server lifecycle and routing
- `src/client.ts` — IPC client for UI/plugins
- `src/security.ts` — Message sanitization and rate limiting
- `src/index.ts` — Public exports

## Behavior (when fully implemented)
- Server starts on chosen transport
- Each incoming message is validated and logged
- Permission checks happen before routing
- Events are broadcast to connected clients
- Graceful shutdown with connection draining

## Standards
- All types use strict TypeScript interfaces
- Validation uses Zod schemas
- Errors follow `code` + `message` pattern
- Timestamps are Unix milliseconds
- IDs are UUID v4 strings
