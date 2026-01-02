# Configuration Management

## Purpose
Provide hierarchical configuration with defaults, environment overrides, and runtime validation.

## Loading Priority
1. **Defaults** (built-in)
2. **Environment variables**
3. **Runtime arguments** (future)

## Configuration Schema
```ts
interface ActaConfig {
  // Runtime
  port: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  
  // Profile & Data
  profileId?: string
  dataDir: string
  
  // LLM (future)
  llm?: {
    defaultProvider: 'ollama' | 'openai' | 'anthropic'
    providers?: {
      openai?: { apiKey?: string }
      anthropic?: { apiKey?: string }
      ollama?: { host: string }
    }
  }
  
  // Trust (future)
  trust?: {
    defaultLevel: 'low' | 'medium' | 'high'
    autoApprove: Record<string, boolean>
    blockedTools: string[]
  }
}
```

## Environment Variables
- `PORT` — Runtime port (default: 5000)
- `LOG_LEVEL` — Logging level (default: info)
- `ACTA_PROFILE_ID` — Active profile
- `ACTA_DATA_DIR` — Data directory (default: ./data)
- `OPENAI_API_KEY` — OpenAI API key
- `ANTHROPIC_API_KEY` — Anthropic API key
- `OLLAMA_HOST` — Ollama host (default: http://localhost:11434)

## Validation Rules
- Port: 1-65535
- Log level: one of allowed values
- Paths: must be accessible
- API keys: format validation

## File Locations (future)
- System config: `/etc/acta/config.json`
- User config: `~/.config/acta/config.json`
- Profile config: `{dataDir}/profiles/{profileId}/config.json`

## Runtime Behavior
- Config is loaded once at startup
- Environment variables override file settings
- Invalid config throws errors
- Changes require restart (Phase-1)

## Security
- API keys never written to files
- Sensitive values from env only
- File permissions 600 for user configs
- No default credentials

## Future Enhancements
- Hot-reload for non-sensitive settings
- Profile-specific inheritance
- Configuration migration
- Remote config management
