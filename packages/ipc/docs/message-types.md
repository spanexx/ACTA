# IPC Message Types Reference

## Core Envelope
```ts
interface ActaMessage<T = any> {
  id: string // UUID v4
  type: ActaMessageType
  source: 'ui' | 'agent' | 'tool' | 'system'
  timestamp: number // Unix ms
  payload: T
}
```

## Message Types

### Commands (UI → Runtime)

#### task.request
Start a new task.
```json
{
  "type": "task.request",
  "payload": {
    "input": "Convert CSV to JSON",
    "context": {
      "files": ["data.csv"],
      "screen": false,
      "clipboard": true
    },
    "trustLevel": "medium"
  }
}
```

#### permission.respond
Respond to a permission prompt.
```json
{
  "type": "permission.respond",
  "payload": {
    "decision": "allow_once" | "deny" | "allow_always"
  }
}
```

#### memory.update
Manage memory entries.
```json
{
  "type": "memory.update",
  "payload": {
    "action": "delete" | "save",
    "memoryId": "mem_456",
    "data": { ... } // for save
  }
}
```

#### plugin.install
Install a plugin (admin only).
```json
{
  "type": "plugin.install",
  "payload": {
    "pluginPath": "/downloads/csv-tools"
  }
}
```

### Events (Runtime → UI)

#### task.plan
Agent generated a plan.
```json
{
  "type": "task.plan",
  "payload": {
    "goal": "Convert CSV to JSON",
    "steps": [
      {
        "id": "s1",
        "tool": "file.read",
        "intent": "Read CSV",
        "input": { "path": "data.csv" },
        "requiresPermission": true
      }
    ],
    "risks": ["Overwrites existing file"]
  }
}
```

#### permission.request
Request user permission.
```json
{
  "type": "permission.request",
  "payload": {
    "tool": "file.write",
    "action": "Write to /Documents/output.json",
    "reason": "Saving converted file",
    "risks": ["Overwrites existing file"],
    "reversible": true,
    "rememberDecision": true
  }
}
```

#### task.step
Step status update.
```json
{
  "type": "task.step",
  "payload": {
    "stepId": "s1",
    "status": "completed" | "running" | "failed"
  }
}
```

#### task.complete
Task finished.
```json
{
  "type": "task.complete",
  "payload": {
    "summary": "Converted 1 CSV to JSON",
    "steps": 1,
    "duration": 1234
  }
}
```

#### error
Runtime error.
```json
{
  "type": "error",
  "payload": {
    "code": "PERMISSION_DENIED",
    "message": "Write access denied",
    "stepId": "s1"
  }
}
```

## Plugin-Only Messages

### tool.execute (Plugin → Runtime)
Execute a tool via registry.
```json
{
  "type": "tool.execute",
  "payload": {
    "tool": "convert_csv",
    "input": { "file": "data.csv" }
  }
}
```
