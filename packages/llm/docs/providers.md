# LLM Providers

## Purpose
Individual LLM provider implementations with unified interface.

## Phase-1 Provider Scope

### Core Providers (Phase-1)
- **Ollama**: Local models (primary focus)
- **OpenAI**: Cloud GPT models (optional, with approval)
- **Anthropic**: Cloud Claude models (optional, with approval)

### Future Providers (Phase-2+)
- **Google Gemini**: Multimodal cloud models
- **Local Llama.cpp**: Direct model loading
- **Hugging Face**: Model hub integration
- **OpenRouter**: Model routing and load balancing
- **Vercel**: Serverless AI functions
- **Custom APIs**: User-defined endpoints

## Ollama Provider (Phase-1 Primary)
### Purpose
Local model hosting with offline support.

### Interface
```ts
class OllamaProvider implements LLMProvider {
  constructor(config: OllamaConfig)
  async isAvailable(): Promise<boolean>
  async listModels(): Promise<ModelInfo[]>
  async generatePlan(prompt: string, context: any): Promise<AgentPlan>
  async generateSummary(prompt: string, context: any): Promise<string>
}
```

### Configuration
```ts
interface OllamaConfig {
  host: string // default: http://localhost:11434
  timeout: number // default: 30000
  maxTokens: number // default: 4096
}
```

### Behavior
- Auto-detects available models via `/api/tags`
- Uses chat completions endpoint
- Handles network errors gracefully
- No API key required

## OpenAI Provider (Phase-1 Optional)
### Purpose
Cloud-based GPT models with high capability.

### Interface
```ts
class OpenAIProvider implements LLMProvider {
  constructor(config: OpenAIConfig)
  async isAvailable(): Promise<boolean>
  async listModels(): Promise<ModelInfo[]>
  async generatePlan(prompt: string, context: any): Promise<AgentPlan>
  async generateSummary(prompt: string, context: any): Promise<string>
}
```

### Configuration
```ts
interface OpenAIConfig {
  apiKey: string
  model?: string // default: gpt-4
  baseUrl?: string // default: https://api.openai.com
  timeout: number // default: 60000
  maxTokens: number // default: 8192
}
```

### Behavior
- Validates API key format
- Uses chat completions with structured output
- Handles rate limits (429)
- Requires explicit approval for cloud usage

## Anthropic Provider (Phase-1 Optional)
### Purpose
Cloud-based Claude models with strong reasoning.

### Interface
```ts
class AnthropicProvider implements LLMProvider {
  constructor(config: AnthropicConfig)
  async isAvailable(): Promise<boolean>
  async listModels(): Promise<ModelInfo[]>
  async generatePlan(prompt: string, context: any): Promise<AgentPlan>
  async generateSummary(prompt: string, context: any): Promise<string>
}
```

### Configuration
```ts
interface AnthropicConfig {
  apiKey: string
  model?: string // default: claude-3-sonnet-20240229
  timeout: number // default: 60000
  maxTokens: number // default: 100000
}
```

### Behavior
- Uses messages API with system prompts
- Handles long context windows
- Implements retry logic with exponential backoff
- Requires explicit approval for cloud usage

## OpenRouter Provider (Phase-2+)
### Purpose
Model routing and load balancing across multiple providers.

### Interface
```ts
class OpenRouterProvider implements LLMProvider {
  constructor(config: OpenRouterConfig)
  async isAvailable(): Promise<boolean>
  async listModels(): Promise<ModelInfo[]>
  async generatePlan(prompt: string, context: any): Promise<AgentPlan>
  async generateSummary(prompt: string, context: any): Promise<string>
}
```

### Configuration
```ts
interface OpenRouterConfig {
  apiKey: string
  models: string[] // model IDs or slugs
  timeout: number // default: 60000
  maxTokens: number // default: 8192
  fallbackModel?: string // if primary unavailable
}
```

### Behavior
- Routes requests to optimal provider/model
- Implements failover between providers
- Handles cost optimization
- Requires explicit approval for cloud usage

## Vercel Provider (Phase-2+)
### Purpose
Serverless AI functions with rapid scaling.

### Interface
```ts
class VercelProvider implements LLMProvider {
  constructor(config: VercelConfig)
  async isAvailable(): Promise<boolean>
  async listModels(): Promise<ModelInfo[]>
  async generatePlan(prompt: string, context: any): Promise<AgentPlan>
  async generateSummary(prompt: string, context: any): Promise<string>
}
```

### Configuration
```ts
interface VercelConfig {
  apiKey: string
  functionName: string // Vercel function name
  timeout: number // default: 30000
  maxTokens: number // default: 4096
}
```

### Behavior
- Calls serverless endpoints
- Implements retry logic with jitter
- Handles cold starts efficiently
- Requires explicit approval for cloud usage

## Provider Selection
Models are evaluated based on:
- **Availability**: Is the provider reachable?
- **Capability**: Does model support required features?
- **Performance**: Response time and reliability
- **Cost**: Token usage and pricing
- **User Preference**: Explicit provider choice

## Error Handling
- **Network errors**: Retry with backoff
- **Authentication**: Clear error messages
- **Rate limits**: Respect 429/timeout responses
- **Invalid requests**: Structured error responses

## Future Providers
- **Google Gemini**: Multimodal cloud models
- **Local Llama.cpp**: Direct model loading
- **Hugging Face**: Model hub integration
- **OpenRouter**: Model routing and load balancing
- **Vercel**: Serverless AI functions
- **Custom APIs**: User-defined endpoints