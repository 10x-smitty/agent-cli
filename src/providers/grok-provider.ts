/**
 * Grok Provider Implementation
 * 
 * Implements the BaseLLMProvider interface for Grok API,
 * maintaining backward compatibility with existing functionality
 */

import { BaseLLMProvider } from './base-provider';
import { GrokClient } from '../grok/client';
import { 
  UniversalMessage, 
  UniversalTool, 
  ChatResponse, 
  StreamingChunk,
  ProviderCapabilities 
} from '../types/llm-types';
import { OpenAICompatibleConfig } from '../types/provider-config';

export class GrokProvider extends BaseLLMProvider {
  private client: GrokClient;
  private availableModels: string[] = ['grok-3-latest', 'grok-4-latest'];

  constructor(config: OpenAICompatibleConfig) {
    super(config);
    this.currentModel = 'grok-3-latest';
  }

  async initialize(): Promise<void> {
    const config = this.config as OpenAICompatibleConfig;
    this.client = new GrokClient(
      config.apiKey!,
      this.currentModel,
      config.baseURL
    );

    // Test connection by attempting to get models (if possible)
    try {
      // Basic connection test - we'll just store the client for now
      // since GrokClient doesn't have a connection test method
    } catch (error: any) {
      throw this.handleError(error, 'initialization');
    }
  }

  async chat(
    messages: UniversalMessage[], 
    tools?: UniversalTool[],
    options?: any
  ): Promise<ChatResponse> {
    this.validateMessages(messages);

    try {
      // Convert universal format to Grok format
      const grokMessages = this.convertToGrokMessages(messages);
      const grokTools = tools ? this.convertToGrokTools(tools) : undefined;

      const response = await this.client.chat(
        grokMessages, 
        grokTools, 
        undefined, 
        options
      );
      
      // Convert back to universal format
      return this.convertFromGrokResponse(response);
    } catch (error: any) {
      throw this.handleError(error, 'chat');
    }
  }

  async *chatStream(
    messages: UniversalMessage[], 
    tools?: UniversalTool[],
    options?: any
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    this.validateMessages(messages);

    try {
      const grokMessages = this.convertToGrokMessages(messages);
      const grokTools = tools ? this.convertToGrokTools(tools) : undefined;

      const stream = this.client.chatStream(
        grokMessages, 
        grokTools, 
        undefined, 
        options
      );

      for await (const chunk of stream) {
        yield this.convertFromGrokStreamChunk(chunk);
      }
    } catch (error: any) {
      yield { type: 'error', error: error.message };
    }
  }

  async getAvailableModels(): Promise<string[]> {
    return this.availableModels;
  }

  setModel(model: string): void {
    if (this.availableModels.includes(model)) {
      this.currentModel = model;
      this.client?.setModel(model);
    } else {
      throw new Error(`Model ${model} not supported by Grok provider`);
    }
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 32768,
      supportedFormats: ['text'],
    };
  }

  validateConfig(): boolean {
    const config = this.config as OpenAICompatibleConfig;
    return !!(config.apiKey && config.type === 'grok');
  }

  // Private conversion methods to translate between universal and Grok formats

  private convertToGrokMessages(messages: UniversalMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      tool_calls: msg.tool_calls,
      tool_call_id: msg.tool_call_id,
    }));
  }

  private convertToGrokTools(tools: UniversalTool[]): any[] {
    return tools
      .filter(tool => tool.type === 'function')
      .map(tool => ({
        type: 'function',
        function: tool.function!,
      }));
  }

  private convertFromGrokResponse(response: any): ChatResponse {
    return {
      id: response.id || 'grok-response',
      choices: response.choices.map((choice: any) => ({
        message: {
          role: choice.message.role,
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        },
        finish_reason: choice.finish_reason,
      })),
      usage: response.usage,
    };
  }

  private convertFromGrokStreamChunk(chunk: any): StreamingChunk {
    if (chunk.choices?.[0]?.delta?.content) {
      return {
        type: 'content',
        content: chunk.choices[0].delta.content,
      };
    }

    if (chunk.choices?.[0]?.delta?.tool_calls) {
      return {
        type: 'tool_calls',
        tool_calls: chunk.choices[0].delta.tool_calls,
      };
    }

    if (chunk.choices?.[0]?.finish_reason) {
      return {
        type: 'done',
        finished_reason: chunk.choices[0].finish_reason,
      };
    }

    return { type: 'content', content: '' };
  }
}
