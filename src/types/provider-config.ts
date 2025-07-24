/**
 * Provider Configuration Types
 * 
 * Defines configuration interfaces for different LLM providers,
 * supporting various authentication and connection options
 */

/**
 * Base configuration interface that all providers extend
 */
export interface BaseProviderConfig {
  type: string;
  name: string;
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Configuration for OpenAI-compatible providers (OpenAI, Grok, OpenRouter)
 */
export interface OpenAICompatibleConfig extends BaseProviderConfig {
  type: 'openai' | 'grok' | 'openrouter';
  organization?: string;
  project?: string;
}

/**
 * Configuration for Anthropic Claude
 */
export interface AnthropicConfig extends BaseProviderConfig {
  type: 'claude';
  version?: string;
}

/**
 * Configuration for Google Gemini
 */
export interface GoogleConfig extends BaseProviderConfig {
  type: 'gemini';
  project?: string;
  location?: string;
}

/**
 * Configuration for Ollama local server
 */
export interface OllamaConfig extends BaseProviderConfig {
  type: 'ollama';
  host?: string;
  port?: number;
}

/**
 * Configuration for LM Studio local server
 */
export interface LMStudioConfig extends BaseProviderConfig {
  type: 'lmstudio';
  host?: string;
  port?: number;
}

/**
 * Union type of all possible provider configurations
 */
export type ProviderConfig = 
  | OpenAICompatibleConfig 
  | AnthropicConfig 
  | GoogleConfig 
  | OllamaConfig 
  | LMStudioConfig;

/**
 * Overall agent configuration including multiple providers
 */
export interface AgentConfig {
  providers: Record<string, ProviderConfig>;
  defaultProvider: string;
  fallbackProviders?: string[];
  globalSettings: {
    timeout: number;
    maxRetries: number;
    enableFallback: boolean;
  };
}
