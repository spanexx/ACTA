# @acta/llm — LLM Engine Router

> Model abstraction + routing. Local-first, cloud-optional.

## Purpose
- Abstract different LLM providers (Ollama, OpenAI, Anthropic)
- Route requests to best available model
- Provide simple mode for Phase-1
- Enable cloud models only with explicit approval

## Core Responsibilities
- **Model Detection**: Scan for available local models
- **Provider Routing**: Choose best model per request
- **Configuration**: Manage API keys and model preferences
- **Offline Support**: Work without internet connectivity
- **Simple Mode**: Fixed prompts for basic tasks

## Expected Files (when fully implemented)
- `src/providers/` — Individual provider implementations
  - `ollama.ts` — Local Ollama integration
  - `openai.ts` — OpenAI API integration
  - `anthropic.ts` — Anthropic API integration
- `src/router.ts` — Model selection and routing logic
- `src/types.ts` — LLM-specific interfaces
- `src/config.ts` — LLM configuration management
- `src/index.ts` — Public exports

## Provider Interface
```ts
interface LLMProvider {
  name: string
  isAvailable(): Promise<boolean>
  listModels(): Promise<ModelInfo[]>
  generatePlan(prompt: string, context: any): Promise<AgentPlan>
  generateSummary(prompt: string, context: any): Promise<string>
}
```

## Model Information
```ts
interface ModelInfo {
  id: string
  name: string
  provider: string
  contextWindow: number
  capabilities: string[]
}
```

## Configuration Schema
```ts
interface LLMConfig {
  defaultProvider: 'ollama' | 'openai' | 'anthropic'
  providers: {
    ollama?: { host: string }
    openai?: { apiKey: string; model?: string }
    anthropic?: { apiKey: string; model?: string }
  }
  simpleMode: {
    enabled: boolean
    systemPrompt: string
  }
}
```

## Routing Strategy
1. **Local first**: Prefer Ollama when available
2. **Capability matching**: Choose model based on task complexity
3. **Fallback order**: Ollama → OpenAI → Anthropic
4. **User preference**: Override routing when specified

## Simple Mode
Fixed system prompt for basic tasks:
```
You are Acta.
You MUST:
- Produce step-by-step plans
- Declare tool usage
- Mark risky steps
- Never execute actions
```

## Security Rules
- API keys from environment only
- No keys in configuration files
- Request/response logging
- Rate limiting per provider
- Content filtering for cloud models

## Future Enhancements
- Model fine-tuning
- Multi-modal support (images, audio)
- Custom model loading
- Provider marketplace
- Cost tracking and limits
