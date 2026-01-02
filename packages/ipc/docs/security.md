# IPC Security Model

## Core Principles
- **Zero trust**: Every message validated
- **Least privilege**: Plugins get limited namespace
- **Auditability**: All messages logged
- **Fail-safe**: Invalid messages rejected silently

## Validation Layers

### 1. Schema Validation
- Enforced via Zod schemas
- Strict type checking
- Required fields validated
- Enum values checked

### 2. Source Authorization
- UI: full command set
- Plugins: limited subset
- Tools: internal events only
- System: internal events only

### 3. Rate Limiting
- Per-source token bucket
- Configurable limits
- Burst allowance
- Backoff on abuse

### 4. Path Normalization
- Filesystem paths resolved
- Symlinks dereferenced
- Sandboxing enforced
- Directory traversal blocked

## Blocked Patterns
- Wildcard commands (`*`, `..`)
- Raw shell calls
- Absolute paths in plugins
- Environment variable injection
- Code execution payloads

## Error Handling
- Invalid messages: silent reject + log
- Rate limited: 429 response
- Unauthorized: 403 response
- Malformed: 400 response

## Logging
- Incoming/outgoing messages
- Validation failures
- Security events
- Performance metrics

## Future Enhancements
- Message signing
- Transport encryption
- Per-profile ACLs
- Dynamic rule updates
