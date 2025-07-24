/**
 * Base LLM Provider Abstract Class
 * 
 * This abstract class defines the common interface that all LLM providers
 * must implement, ensuring consistent behavior across different AI services.
 */

import { EventEmitter } from 'events';
import { 
  UniversalMessage, 
  UniversalTool, 
  ChatResponse, 
  StreamingChunk,
  ProviderCapabilities 
} from '../types/llm-types';
import { ProviderConfig } from '../types/provider-config';

export abstract class BaseLLMProvider extends EventEmitter {
  protected config: ProviderConfig;
  protected currentModel: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.currentModel = '';
  }

  // Core abstract methods that all providers must implement
  
  /**
   * Initialize the provider with necessary setup (API clients, connections, etc.)
   */
  abstract initialize(): Promise<void>;
  
  /**
   * Send a chat completion request and return the full response
   */
  abstract chat(
    messages: UniversalMessage[], 
    tools?: UniversalTool[],
    options?: any
  ): Promise<ChatResponse>;
  
  /**
   * Send a streaming chat completion request
   */
  abstract chatStream(
    messages: UniversalMessage[], 
    tools?: UniversalTool[],
    options?: any
  ): AsyncGenerator<StreamingChunk, void, unknown>;
  
  /**
   * Get list of available models for this provider
   */
  abstract getAvailableModels(): Promise<string[]>;
  
  /**
   * Set the current model to use for requests
   */
  abstract setModel(model: string): void;
  
  /**
   * Get the currently selected model
   */
  abstract getCurrentModel(): string;
  
  /**
   * Get the capabilities of this provider (streaming, function calling, etc.)
   */
  abstract getCapabilities(): ProviderCapabilities;
  
  /**
   * Validate that the provider configuration is correct
   */
  abstract validateConfig(): boolean;

  // Common utility methods available to all providers

  /**
   * Validate that messages array is properly formatted
   */
  protected validateMessages(messages: UniversalMessage[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const message of messages) {
      if (!['system', 'user', 'assistant', 'tool'].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
    }
  }

  /**
   * Standardized error handling with provider context
   */
  protected handleError(error: any, context: string): Error {
    const errorMessage = `${this.config.type} Provider Error in ${context}: ${error.message}`;
    this.emit('error', { error, context, provider: this.config.type });
    return new Error(errorMessage);
  }

  /**
   * Get provider metadata and current status
   */
  getProviderInfo() {
    return {
      type: this.config.type,
      name: this.config.name,
      currentModel: this.currentModel,
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * Check if the provider supports a specific capability
   */
  supportsCapability(capability: keyof ProviderCapabilities): boolean {
    const capabilities = this.getCapabilities();
    return capabilities[capability] as boolean;
  }

  /**
   * Get configuration without exposing sensitive information
   */
  getPublicConfig() {
    const { apiKey, ...publicConfig } = this.config;
    return {
      ...publicConfig,
      hasApiKey: !!apiKey,
    };
  }
}
