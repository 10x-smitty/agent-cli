/**
 * Universal Agent Base
 * 
 * Base class for agents that work with multiple LLM providers
 * through the universal provider interface
 */

import { EventEmitter } from 'events';
import { BaseLLMProvider } from '../providers/base-provider';
import { UniversalMessage, UniversalTool, StreamingChunk } from '../types/llm-types';

export interface AgentEvents {
  'provider-error': (error: any) => void;
  'provider-switched': (providerInfo: any) => void;
  'message-processed': (message: UniversalMessage) => void;
  'tool-execution-started': (toolCall: any) => void;
  'tool-execution-completed': (toolCall: any, result: any) => void;
}

export declare interface UniversalAgentBase {
  on<K extends keyof AgentEvents>(event: K, listener: AgentEvents[K]): this;
  emit<K extends keyof AgentEvents>(event: K, ...args: Parameters<AgentEvents[K]>): boolean;
}

export class UniversalAgentBase extends EventEmitter {
  protected provider: BaseLLMProvider;
  protected messages: UniversalMessage[] = [];
  protected tools: UniversalTool[] = [];

  constructor(provider: BaseLLMProvider) {
    super();
    this.provider = provider;
    
    // Forward provider events with additional context
    this.provider.on('error', (error) => this.emit('provider-error', error));
  }

  /**
   * Switch to a different LLM provider while maintaining conversation state
   */
  async switchProvider(newProvider: BaseLLMProvider): Promise<void> {
    // Clean up old provider listeners
    this.provider.removeAllListeners();
    
    // Set new provider and attach listeners
    this.provider = newProvider;
    this.provider.on('error', (error) => this.emit('provider-error', error));
    
    this.emit('provider-switched', newProvider.getProviderInfo());
  }

  /**
   * Get current provider instance
   */
  getCurrentProvider(): BaseLLMProvider {
    return this.provider;
  }

  /**
   * Get current provider information
   */
  getProviderInfo() {
    return this.provider.getProviderInfo();
  }

  /**
   * Set available tools for the agent
   */
  setTools(tools: UniversalTool[]): void {
    this.tools = tools;
  }

  /**
   * Add a tool to the available tools
   */
  addTool(tool: UniversalTool): void {
    this.tools.push(tool);
  }

  /**
   * Remove a tool from available tools
   */
  removeTool(toolName: string): void {
    this.tools = this.tools.filter(tool => {
      if (tool.type === 'function') {
        return tool.function?.name !== toolName;
      } else if (tool.type === 'mcp') {
        return tool.mcp?.tool !== toolName;
      }
      return true;
    });
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): UniversalTool[] {
    return [...this.tools];
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): UniversalMessage[] {
    return [...this.messages];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(message: UniversalMessage): void {
    this.messages.push(message);
    this.emit('message-processed', message);
  }

  /**
   * Process a user message and yield streaming responses
   */
  async *processUserMessageStream(
    message: string,
    options?: any
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Add user message to history
    const userMessage: UniversalMessage = {
      role: 'user',
      content: message,
    };
    
    this.addMessage(userMessage);

    try {
      // Get streaming response from provider
      const stream = this.provider.chatStream(this.messages, this.tools, options);
      
      let currentAssistantMessage: UniversalMessage = {
        role: 'assistant',
        content: '',
      };

      for await (const chunk of stream) {
        // Handle different chunk types
        if (chunk.type === 'content' && chunk.content) {
          currentAssistantMessage.content = (currentAssistantMessage.content || '') + chunk.content;
          yield chunk;
        }
        
        if (chunk.type === 'tool_calls' && chunk.tool_calls) {
          currentAssistantMessage.tool_calls = chunk.tool_calls;
          yield chunk;
          
          // Add the assistant message with tool calls to history before executing tools
          this.addMessage(currentAssistantMessage);
          
          // Execute tools and yield results
          yield* this.handleToolCalls(chunk.tool_calls);
          
          // After tool execution, continue with LLM to process tool results
          yield* this.continueAfterToolExecution();
          
          // Reset current message since we already added it
          currentAssistantMessage = {
            role: 'assistant',
            content: '',
          };
        }
        
        if (chunk.type === 'done') {
          // Add completed assistant message to history
          this.addMessage(currentAssistantMessage);
          yield chunk;
          break;
        }
        
        if (chunk.type === 'error') {
          yield chunk;
          break;
        }
      }
    } catch (error: any) {
      yield { type: 'error', error: error.message };
    }
  }

  /**
   * Process a user message and return the complete response
   */
  async processUserMessage(message: string, options?: any): Promise<UniversalMessage> {
    const chunks: StreamingChunk[] = [];
    
    for await (const chunk of this.processUserMessageStream(message, options)) {
      chunks.push(chunk);
      
      if (chunk.type === 'done' || chunk.type === 'error') {
        break;
      }
    }

    // Reconstruct the complete response
    const content = chunks
      .filter(chunk => chunk.type === 'content')
      .map(chunk => chunk.content)
      .join('');

    const toolCalls = chunks
      .filter(chunk => chunk.type === 'tool_calls')
      .flatMap(chunk => chunk.tool_calls || []);

    return {
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Handle tool execution (to be implemented by derived classes)
   */
  protected async *handleToolCalls(
    toolCalls: any[]
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    for (const toolCall of toolCalls) {
      this.emit('tool-execution-started', toolCall);
      
      // Placeholder implementation - derived classes should override this
      yield { 
        type: 'content', 
        content: `\n[Tool execution: ${toolCall.function.name}]\n` 
      };
      
      this.emit('tool-execution-completed', toolCall, { success: true });
    }
  }

  /**
   * Continue LLM conversation after tool execution to process results
   */
  protected async *continueAfterToolExecution(): AsyncGenerator<StreamingChunk, void, unknown> {
    try {
      // Get streaming response from provider with updated conversation (including tool results)
      const continuationStream = this.provider.chatStream(this.messages, this.tools);
      
      let currentAssistantMessage: UniversalMessage = {
        role: 'assistant',
        content: '',
      };
      
      for await (const chunk of continuationStream) {
        if (chunk.type === 'content' && chunk.content) {
          currentAssistantMessage.content = (currentAssistantMessage.content || '') + chunk.content;
          // Convert content chunks to response chunks to separate them from tool output
          yield { type: 'response', content: chunk.content };
        }
        
        if (chunk.type === 'tool_calls' && chunk.tool_calls) {
          // Handle nested tool calls if needed
          currentAssistantMessage.tool_calls = chunk.tool_calls;
          this.addMessage(currentAssistantMessage);
          
          yield chunk;
          yield* this.handleToolCalls(chunk.tool_calls);
          yield* this.continueAfterToolExecution();
          
          // Reset current message since we already added it
          currentAssistantMessage = {
            role: 'assistant',
            content: '',
          };
        }
        
        if (chunk.type === 'done') {
          // Add the final assistant message to history if it has content
          if (currentAssistantMessage.content && currentAssistantMessage.content.trim()) {
            this.addMessage(currentAssistantMessage);
          }
          yield chunk;
          break;
        }
        
        if (chunk.type === 'error') {
          yield chunk;
          break;
        }
      }
    } catch (error: any) {
      yield { type: 'error', error: error.message };
    }
  }

  /**
   * Get available models from the current provider
   */
  async getAvailableModels(): Promise<string[]> {
    return await this.provider.getAvailableModels();
  }

  /**
   * Set the model for the current provider
   */
  setModel(model: string): void {
    this.provider.setModel(model);
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.provider.getCurrentModel();
  }

  /**
   * Check if current provider supports a capability
   */
  supportsCapability(capability: string): boolean {
    return this.provider.supportsCapability(capability as any);
  }
}
