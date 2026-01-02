# Runtime Host

## Purpose
The always-on background daemon that manages Acta's lifecycle and coordinates all subsystems.

## Responsibilities
- Run in background (survives UI open/close)
- Expose local IPC/API
- Manage processes (LLM, plugins, tools)
- Maintain session state per user profile
- Handle graceful shutdown

## Lifecycle
```
Start → Load Profile → Init Subsystems → Start IPC → Ready → Serve → Shutdown
```

## Startup Sequence
1. **Logging** (first, always)
2. **Configuration** loading
3. **Profile** resolution
4. **Trust Engine** init
5. **Memory Engine** init
6. **Tool Registry** init
7. **LLM Router** init
8. **Agent Loop** init
9. **IPC Server** start (last)

## Shutdown Sequence
1. **Stop accepting new tasks**
2. **Wait for in-flight tasks** (with timeout)
3. **Stop IPC Server**
4. **Shutdown Agent Loop**
5. **Persist memory/state**
6. **Stop subsystems**
7. **Exit**

## Process Management
```ts
interface RuntimeHost {
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  getStatus(): RuntimeStatus
  getHealth(): HealthCheck
}
```

## Health Monitoring
- Component status checks
- Resource usage (CPU, memory)
- Error rates
- Performance metrics

## Signals Handling
- **SIGINT**: Graceful shutdown
- **SIGTERM**: Graceful shutdown
- **SIGHUP**: Reload configuration (future)
- **SIGUSR1**: Health check (future)

## Resource Limits
- Max concurrent tasks
- Memory usage caps
- File descriptor limits
- Network connection limits

## Security Boundaries
- No UI rendering
- No direct OS actions
- No network access unless configured
- All actions through subsystems

## Future Enhancements
- OS boot integration (systemd/launchd)
- Process monitoring
- Auto-restart on crash
- Resource quotas
