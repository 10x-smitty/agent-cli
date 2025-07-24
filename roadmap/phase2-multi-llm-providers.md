# Phase 2: Multi-LLM Provider Implementation (Week 3-4)

## Phase Overview

This phase focuses on implementing concrete provider classes for major LLM services including Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google), Ollama, LM Studio, and OpenRouter. Each provider will implement the universal interface established in Phase 1, handling API-specific formatting, authentication, and feature differences while presenting a consistent interface to the agent.

Key deliverables include fully functional provider implementations, robust error handling and retry logic, model-specific optimizations, and comprehensive testing across all provider types.

## Development Prompt

```
You are implementing multiple LLM provider classes for a TypeScript CLI application. Each provider must implement a universal interface while handling the unique characteristics of different AI APIs. Your objectives are:

1. Implement Claude Provider using Anthropic SDK with proper message formatting and tool calling
2. Create OpenAI Provider with full GPT model support and streaming capabilities  
3. Build Gemini Provider with Google AI SDK integration and safety settings
4. Develop Ollama Provider for local model serving with health checks
5. Implement LM Studio Provider for local API compatibility
6. Create OpenRouter Provider for multi-model API access
7. Handle provider-specific features like system messages, tool calling formats, and streaming differences
8. Implement robust error handling, rate limiting, and retry logic for each provider
9. Optimize for each provider's strengths while maintaining universal compatibility

Focus on production-ready implementations with proper error handling, logging, and configuration validation. Ensure each provider gracefully handles network issues, API changes, and model availability.
```

## Action Items Checklist

### Claude Provider (Anthropic)
- [ ] Install and configure Anthropic SDK
- [ ] Implement Claude-specific message formatting
- [ ] Handle Claude's system message requirements
- [ ] Implement tool calling with Claude's format
- [ ] Add streaming support for Claude responses
- [ ] Handle Claude-specific errors and rate limits
- [ ] Implement model switching (Claude-3.5 Sonnet, Haiku, Opus)
- [ ] Add safety settings and content filtering

### OpenAI Provider
- [x] Configure OpenAI SDK for ChatGPT access (2025-01-23 02:45)
- [x] Implement GPT-4o, GPT-4, and GPT-3.5 support (2025-01-23 02:45)
- [x] Handle OpenAI's tool calling format (2025-01-23 02:45)
- [x] Implement streaming with proper chunk handling (2025-01-23 02:45)
- [x] Add organization and project ID support (2025-01-23 02:45)
- [x] Handle OpenAI-specific errors and rate limits (2025-01-23 02:45)
- [x] Implement model capabilities detection (2025-01-23 02:45)
- [x] Add vision support for multimodal models (2025-01-23 02:45)

### Gemini Provider (Google)
- [ ] Install Google Generative AI SDK
- [ ] Implement Gemini Pro and Flash model support
- [ ] Handle Google's unique message format
- [ ] Implement function calling with Gemini
- [ ] Add safety settings configuration
- [ ] Handle Google Cloud authentication
- [ ] Implement streaming responses
- [ ] Add content filtering and safety checks

### Ollama Provider
- [ ] Implement Ollama REST API client
- [ ] Add local server health checking
- [ ] Handle model pulling and availability
- [ ] Implement streaming chat completions
- [ ] Add custom model support
- [ ] Handle connection timeouts and retries
- [ ] Implement model listing and selection
- [ ] Add embedding support for RAG features

### LM Studio Provider  
- [ ] Create LM Studio API client
- [ ] Handle local server configuration
- [ ] Implement OpenAI-compatible endpoints
- [ ] Add model management features
- [ ] Handle server startup detection
- [ ] Implement streaming with LM Studio format
- [ ] Add custom model loading
- [ ] Handle performance optimization settings

### OpenRouter Provider
- [ ] Configure OpenRouter API access
- [ ] Implement multi-model routing
- [ ] Handle OpenRouter's model selection
- [ ] Add cost tracking and budgets
- [ ] Implement rate limiting per model
- [ ] Handle provider-specific errors
- [ ] Add model filtering and preferences
- [ ] Implement fallback model selection

### Enhanced Configuration
- [ ] Create provider-specific config schemas
- [ ] Add configuration validation for each provider
- [ ] Implement credential management
- [ ] Add provider health checking
- [ ] Create configuration migration utilities
- [ ] Add environment variable support
- [ ] Implement secure credential storage

### Testing & Quality
- [ ] Create unit tests for each provider
- [ ] Add integration tests with live APIs
- [ ] Implement mock providers for testing
- [ ] Add performance benchmarking
- [ ] Create provider compatibility tests
- [ ] Add error scenario testing
- [ ] Implement load testing for local providers

## Detailed Implementation Guide

### Step 1: Claude Provider Implementation

Start with the Claude provider as it has unique message formatting requirements:

```typescript
// src/providers/claude-provider.ts
import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './base-provider';
import { 
  UniversalMessage, 
  UniversalTool, 
  ChatResponse, 
  StreamingChunk,
  ProviderCapabilities,
  AnthropicConfig 
} from '../types/llm-types';

export class ClaudeProvider extends BaseLLMProvider {
  private client: Anthropic;
  private availableModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022', 
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ];

  constructor(config: AnthropicConfig) {
    super(config);
    this.currentModel = 'claude-3-5-sonnet-20241022';
  }

  async initialize(): Promise<void> {
    const config = this.config as AnthropicConfig;
    this.client = new Anthropic({
      apiKey: config.apiKey!,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
    });

    // Test the connection
    try {
      await this.client.messages.create({
        model: this.currentModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
    } catch (error) {
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
      const { system, messages: claudeMessages } = this.formatClaudeMessages(messages);
      const claudeTools = tools ? this.formatClaudeTools(tools) : undefined;

      const response = await this.client.messages.create({
        model: this.currentModel,
        max_tokens: options?.maxTokens || 4000,
        temperature: options?.temperature || 0.7,
        system: system || undefined,
        messages: claudeMessages,
        tools: claudeTools,
        ...options,
      });

      return this.convertClaudeResponse(response);
    } catch (error) {
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
      const { system, messages: claudeMessages } = this.formatClaudeMessages(messages);
      const claudeTools = tools ? this.formatClaudeTools(tools) : undefined;

      const stream = await this.client.messages.create({
        model: this.currentModel,
        max_tokens: options?.maxTokens || 4000,
        temperature: options?.temperature || 0.7,
        system: system || undefined,
        messages: claudeMessages,
        tools: claudeTools,
        stream: true,
        ...options,
      });

      for await (const chunk of stream) {
        yield this.convertClaudeStreamChunk(chunk);
      }
    } catch (error) {
      yield { type: 'error', error: error.message };
    }
  }

  async getAvailableModels(): Promise<string[]> {
    return this.availableModels;
  }

  setModel(model: string): void {
    if (this.availableModels.includes(model)) {
      this.currentModel = model;
    } else {
      throw new Error(`Model ${model} not supported by Claude provider`);
    }
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true,
      vision: this.currentModel.includes('3-5') || this.currentModel.includes('opus'),
      maxTokens: this.currentModel.includes('haiku') ? 4000 : 8000,
      supportedFormats: ['text', 'image'],
    };
  }

  validateConfig(): boolean {
    const config = this.config as AnthropicConfig;
    return !!(config.apiKey && config.type === 'claude');
  }

  // Claude-specific formatting methods
  private formatClaudeMessages(messages: UniversalMessage[]): {
    system: string | null;
    messages: any[];
  } {
    let system: string | null = null;
    const claudeMessages: any[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Claude handles system messages separately
        system = message.content;
      } else if (message.role === 'tool') {
        // Convert tool responses to Claude format
        claudeMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.tool_call_id,
              content: message.content,
            },
          ],
        });
      } else {
        // Handle assistant messages with tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          const content = [];
          
          if (message.content) {
            content.push({ type: 'text', text: message.content });
          }

          for (const toolCall of message.tool_calls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments),
            });
          }

          claudeMessages.push({
            role: message.role,
            content,
          });
        } else {
          claudeMessages.push({
            role: message.role,
            content: message.content,
          });
        }
      }
    }

    return { system, messages: claudeMessages };
  }

  private formatClaudeTools(tools: UniversalTool[]): any[] {
    return tools
      .filter(tool => tool.type === 'function')
      .map(tool => ({
        name: tool.function!.name,
        description: tool.function!.description,
        input_schema: {
          type: 'object',
          properties: tool.function!.parameters.properties,
          required: tool.function!.parameters.required,
        },
      }));
  }

  private convertClaudeResponse(response: any): ChatResponse {
    const message: UniversalMessage = {
      role: 'assistant',
      content: '',
    };

    // Handle Claude's content blocks
    if (response.content && Array.isArray(response.content)) {
      const textBlocks = response.content.filter((block: any) => block.type === 'text');
      const toolBlocks = response.content.filter((block: any) => block.type === 'tool_use');

      message.content = textBlocks.map((block: any) => block.text).join('');

      if (toolBlocks.length > 0) {
        message.tool_calls = toolBlocks.map((block: any) => ({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        }));
      }
    }

    return {
      id: response.id,
      choices: [
        {
          message,
          finish_reason: response.stop_reason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
    };
  }

  private convertClaudeStreamChunk(chunk: any): StreamingChunk {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      return {
        type: 'content',
        content: chunk.delta.text,
      };
    }

    if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
      return {
        type: 'tool_calls',
        tool_calls: [
          {
            id: chunk.content_block.id,
            type: 'function',
            function: {
              name: chunk.content_block.name,
              arguments: JSON.stringify(chunk.content_block.input),
            },
          },
        ],
      };
    }

    if (chunk.type === 'message_stop') {
      return {
        type: 'done',
        finished_reason: chunk.stop_reason || 'stop',
      };
    }

    return { type: 'content', content: '' };
  }
}
```

### Step 2: OpenAI Provider Implementation

Implement the OpenAI provider with full GPT model support:

```typescript
// src/providers/openai-provider.ts
import OpenAI from 'openai';
import { BaseLLMProvider } from './base-provider';
import { 
  UniversalMessage, 
  UniversalTool, 
  ChatResponse, 
  StreamingChunk,
  ProviderCapabilities,
  OpenAICompatibleConfig 
} from '../types/llm-types';

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;
  private availableModels = [
    'gpt-4o',
    'gpt-4o-mini', 
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'gpt-4-vision-preview'
  ];

  constructor(config: OpenAICompatibleConfig) {
    super(config);
    this.currentModel = 'gpt-4o';
  }

  async initialize(): Promise<void> {
    const config = this.config as OpenAICompatibleConfig;
    this.client = new OpenAI({
      apiKey: config.apiKey!,
      organization: config.organization,
      project: config.project,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
    });

    // Fetch actual available models
    try {
      const models = await this.client.models.list();
      this.availableModels = models.data
        .filter(model => model.id.startsWith('gpt-'))
        .map(model => model.id);
    } catch (error) {
      console.warn('Could not fetch OpenAI models, using defaults');
    }
  }

  async chat(
    messages: UniversalMessage[], 
    tools?: UniversalTool[],
    options?: any
  ): Promise<ChatResponse> {
    this.validateMessages(messages);

    try {
      const openaiMessages = this.formatOpenAIMessages(messages);
      const openaiTools = tools ? this.formatOpenAITools(tools) : undefined;

      const response = await this.client.chat.completions.create({
        model: this.currentModel,
        messages: openaiMessages,
        tools: openaiTools,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 4000,
        ...options,
      });

      return this.convertOpenAIResponse(response);
    } catch (error) {
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
      const openaiMessages = this.formatOpenAIMessages(messages);
      const openaiTools = tools ? this.formatOpenAITools(tools) : undefined;

      const stream = await this.client.chat.completions.create({
        model: this.currentModel,
        messages: openaiMessages,
        tools: openaiTools,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 4000,
        stream: true,
        ...options,
      });

      for await (const chunk of stream) {
        yield this.convertOpenAIStreamChunk(chunk);
      }
    } catch (error) {
      yield { type: 'error', error: error.message };
    }
  }

  async getAvailableModels(): Promise<string[]> {
    return this.availableModels;
  }

  setModel(model: string): void {
    if (this.availableModels.includes(model)) {
      this.currentModel = model;
    } else {
      throw new Error(`Model ${model} not supported by OpenAI provider`);
    }
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCapabilities(): ProviderCapabilities {
    const isVisionModel = this.currentModel.includes('vision') || this.currentModel.includes('4o');
    return {
      streaming: true,
      functionCalling: true,
      vision: isVisionModel,
      maxTokens: this.currentModel.includes('gpt-4') ? 8000 : 4000,
      supportedFormats: isVisionModel ? ['text', 'image'] : ['text'],
    };
  }

  validateConfig(): boolean {
    const config = this.config as OpenAICompatibleConfig;
    return !!(config.apiKey && config.type === 'openai');
  }

  private formatOpenAIMessages(messages: UniversalMessage[]): any[] {
    return messages.map(message => ({
      role: message.role,
      content: message.content,
      tool_calls: message.tool_calls,
      tool_call_id: message.tool_call_id,
      name: message.name,
    }));
  }

  private formatOpenAITools(tools: UniversalTool[]): any[] {
    return tools
      .filter(tool => tool.type === 'function')
      .map(tool => ({
        type: 'function',
        function: {
          name: tool.function!.name,
          description: tool.function!.description,
          parameters: {
            type: 'object',
            properties: tool.function!.parameters.properties,
            required: tool.function!.parameters.required,
          },
        },
      }));
  }

  private convertOpenAIResponse(response: any): ChatResponse {
    return {
      id: response.id,
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

  private convertOpenAIStreamChunk(chunk: any): StreamingChunk {
    const delta = chunk.choices?.[0]?.delta;
    
    if (delta?.content) {
      return {
        type: 'content',
        content: delta.content,
      };
    }

    if (delta?.tool_calls) {
      return {
        type: 'tool_calls',
        tool_calls: delta.tool_calls,
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
```

### Step 3: Gemini Provider Implementation

Create the Google Gemini provider with safety settings:

```typescript
// src/providers/gemini-provider.ts
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { BaseLLMProvider } from './base-provider';
import { 
  UniversalMessage, 
  UniversalTool, 
  ChatResponse, 
  StreamingChunk,
  ProviderCapabilities,
  GoogleConfig 
} from '../types/llm-types';

export class GeminiProvider extends BaseLLMProvider {
  private client: GoogleGenerativeAI;
  private availableModels = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro'
  ];

  constructor(config: GoogleConfig) {
    super(config);
    this.currentModel = 'gemini-1.5-pro';
  }

  async initialize(): Promise<void> {
    const config = this.config as GoogleConfig;
    this.client = new GoogleGenerativeAI(config.apiKey!);
  }

  async chat(
    messages: UniversalMessage[], 
    tools?: UniversalTool[],
    options?: any
  ): Promise<ChatResponse> {
    this.validateMessages(messages);

    try {
      const model = this.client.getGenerativeModel({ 
        model: this.currentModel,
        tools: tools ? this.formatGeminiTools(tools) : undefined,
        safetySettings: this.getSafetySettings(),
      });

      const { history, lastMessage } = this.formatGeminiMessages(messages);
      
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage);

      return this.convertGeminiResponse(result);
    } catch (error) {
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
      const model = this.client.getGenerativeModel({ 
        model: this.currentModel,
        tools: tools ? this.formatGeminiTools(tools) : undefined,
        safetySettings: this.getSafetySettings(),
      });

      const { history, lastMessage } = this.formatGeminiMessages(messages);
      
      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMessage);

      for await (const chunk of result.stream) {
        yield this.convertGeminiStreamChunk(chunk);
      }
    } catch (error) {
      yield { type: 'error', error: error.message };
    }
  }

  async getAvailableModels(): Promise<string[]> {
    return this.availableModels;
  }

  setModel(model: string): void {
    if (this.availableModels.includes(model)) {
      this.currentModel = model;
    } else {
      throw new Error(`Model ${model} not supported by Gemini provider`);
    }
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 32768,
      supportedFormats: ['text', 'image', 'video', 'audio'],
    };
  }

  validateConfig(): boolean {
    const config = this.config as GoogleConfig;
    return !!(config.apiKey && config.type === 'gemini');
  }

  private formatGeminiMessages(messages: UniversalMessage[]): {
    history: any[];
    lastMessage: string;
  } {
    const history: any[] = [];
    let lastMessage = '';

    // Skip system message as Gemini handles it differently
    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    for (let i = 0; i < conversationMessages.length - 1; i++) {
      const message = conversationMessages[i];
      history.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      });
    }

    // Last message is sent separately
    if (conversationMessages.length > 0) {
      const lastMsg = conversationMessages[conversationMessages.length - 1];
      lastMessage = lastMsg.content || '';
    }

    return { history, lastMessage };
  }

  private formatGeminiTools(tools: UniversalTool[]): any[] {
    const functionDeclarations = tools
      .filter(tool => tool.type === 'function')
      .map(tool => ({
        name: tool.function!.name,
        description: tool.function!.description,
        parameters: {
          type: 'object',
          properties: tool.function!.parameters.properties,
          required: tool.function!.parameters.required,
        },
      }));

    return functionDeclarations.length > 0 ? [{ functionDeclarations }] : [];
  }

  private getSafetySettings() {
    return [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];
  }

  private convertGeminiResponse(result: any): ChatResponse {
    const response = result.response;
    const text = response.text() || '';
    
    // Handle function calls
    let tool_calls;
    if (response.functionCalls && response.functionCalls.length > 0) {
      tool_calls = response.functionCalls.map((call: any, index: number) => ({
        id: `gemini_${Date.now()}_${index}`,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args),
        },
      }));
    }

    return {
      id: `gemini-${Date.now()}`,
      choices: [
        {
          message: {
            role: 'assistant',
            content: text,
            tool_calls,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: result.response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: result.response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  private convertGeminiStreamChunk(chunk: any): StreamingChunk {
    const text = chunk.text();
    
    if (text) {
      return {
        type: 'content',
        content: text,
      };
    }

    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      const tool_calls = chunk.functionCalls.map((call: any, index: number) => ({
        id: `gemini_${Date.now()}_${index}`,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args),
        },
      }));

      return {
        type: 'tool_calls',
        tool_calls,
      };
    }

    return { type: 'content', content: '' };
  }
}
```

### Step 4: Ollama Provider Implementation

Create the Ollama provider for local model serving:

```typescript
// src/providers/ollama-provider.ts
import fetch from 'node-fetch';
import { BaseLLMProvider } from './base-provider';
import { 
  UniversalMessage, 
  UniversalTool, 
  ChatResponse, 
  StreamingChunk,
  ProviderCapabilities,
  OllamaConfig 
} from '../types/llm-types';

export class OllamaProvider extends BaseLLMProvider {
  private baseUrl: string;
  private availableModels: string[] = [];

  constructor(config: OllamaConfig) {
    super(config);
    this.baseUrl = `http://${config.host || 'localhost'}:${config.port || 11434}`;
    this.currentModel = 'llama3.2';
  }

  async initialize(): Promise<void> {
    // Check if Ollama is running
    await this.checkHealth();
    
    // Fetch available models
    await this.refreshModels();
  }

  private async checkHealth(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        timeout: 5000,
      });

      if (!response.ok) {
        throw new Error(`Ollama server returned ${response.status}`);
      }
    } catch (error) {
      throw this.handleError(error, 'health check');
    }
  }

  private async refreshModels(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json();
      
      this.availableModels = data.models?.map((model: any) => model.name) || [];
      
      if (this.availableModels.length > 0 && !this.availableModels.includes(this.currentModel)) {
        this.currentModel = this.availableModels[0];
      }
    } catch (error) {
      console.warn('Could not refresh Ollama models:', error.message);
    }
  }

  async chat(
    messages: UniversalMessage[], 
    tools?: UniversalTool[],
    options?: any
  ): Promise<ChatResponse> {
    this.validateMessages(messages);

    try {
      const ollamaMessages = this.formatOllamaMessages(messages);
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.currentModel,
          messages: ollamaMessages,
          tools: tools ? this.formatOllamaTools(tools) : undefined,
          stream: false,
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 4000,
            ...options,
          },
        }),
        timeout: this.config.timeout || 120000,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.convertOllamaResponse(data);
    } catch (error) {
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
      const ollamaMessages = this.formatOllamaMessages(messages);
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.currentModel,
          messages: ollamaMessages,
          tools: tools ? this.formatOllamaTools(tools) : undefined,
          stream: true,
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 4000,
            ...options,
          },
        }),
        timeout: this.config.timeout || 120000,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                yield this.convertOllamaStreamChunk(data);
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      yield { type: 'error', error: error.message };
    }
  }

  async getAvailableModels(): Promise<string[]> {
    await this.refreshModels();
    return this.availableModels;
  }

  setModel(model: string): void {
    // Ollama allows any model name, as it can pull models on demand
    this.currentModel = model;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: false, // Most Ollama models don't support function calling yet
      vision: this.currentModel.includes('vision') || this.currentModel.includes('llava'),
      maxTokens: 4096, // Varies by model
      supportedFormats: ['text'],
    };
  }

  validateConfig(): boolean {
    const config = this.config as OllamaConfig;
    return config.type === 'ollama';
  }

  private formatOllamaMessages(messages: UniversalMessage[]): any[] {
    return messages.map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));
  }

  private formatOllamaTools(tools: UniversalTool[]): any[] {
    return tools
      .filter(tool => tool.type === 'function')
      .map(tool => ({
        type: 'function',
        function: {
          name: tool.function!.name,
          description: tool.function!.description,
          parameters: tool.function!.parameters,
        },
      }));
  }

  private convertOllamaResponse(data: any): ChatResponse {
    return {
      id: `ollama-${Date.now()}`,
      choices: [
        {
          message: {
            role: 'assistant',
            content: data.message?.content || '',
          },
          finish_reason: data.done ? 'stop' : 'length',
        },
      ],
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  private convertOllamaStreamChunk(data: any): StreamingChunk {
    if (data.message?.content) {
      return {
        type: 'content',
        content: data.message.content,
      };
    }

    if (data.done) {
      return {
        type: 'done',
        finished_reason: 'stop',
      };
    }

    return { type: 'content', content: '' };
  }

  // Utility methods for model management
  async pullModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model ${modelName}`);
    }

    // Wait for pull to complete
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status === 'success') {
              return;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

### Step 5: Provider Registration System

Update the provider factory to register all providers:

```typescript
// src/providers/index.ts
import { ProviderFactory } from './provider-factory';
import { GrokProvider } from './grok-provider';
import { ClaudeProvider } from './claude-provider';
import { OpenAIProvider } from './openai-provider';
import { GeminiProvider } from './gemini-provider';
import { OllamaProvider } from './ollama-provider';

// Register all providers
ProviderFactory.registerProvider('grok', GrokProvider);
ProviderFactory.registerProvider('claude', ClaudeProvider);
ProviderFactory.registerProvider('openai', OpenAIProvider);
ProviderFactory.registerProvider('gemini', GeminiProvider);
ProviderFactory.registerProvider('ollama', OllamaProvider);

export {
  ProviderFactory,
  GrokProvider,
  ClaudeProvider,
  OpenAIProvider,
  GeminiProvider,
  OllamaProvider,
};
```

### Step 6: Enhanced Configuration Schema

Create comprehensive configuration validation:

```typescript
// src/config/provider-schemas.ts
import { z } from 'zod';

const BaseProviderSchema = z.object({
  type: z.string(),
  name: z.string(),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  timeout: z.number().optional(),
  maxRetries: z.number().optional(),
});

export const GrokConfigSchema = BaseProviderSchema.extend({
  type: z.literal('grok'),
  organization: z.string().optional(),
  project: z.string().optional(),
});

export const ClaudeConfigSchema = BaseProviderSchema.extend({
  type: z.literal('claude'),
  version: z.string().optional(),
});

export const OpenAIConfigSchema = BaseProviderSchema.extend({
  type: z.literal('openai'),
  organization: z.string().optional(),
  project: z.string().optional(),
});

export const GeminiConfigSchema = BaseProviderSchema.extend({
  type: z.literal('gemini'),
  project: z.string().optional(),
  location: z.string().optional(),
});

export const OllamaConfigSchema = BaseProviderSchema.extend({
  type: z.literal('ollama'),
  host: z.string().optional(),
  port: z.number().optional(),
});

export const ProviderConfigSchema = z.union([
  GrokConfigSchema,
  ClaudeConfigSchema,
  OpenAIConfigSchema,
  GeminiConfigSchema,
  OllamaConfigSchema,
]);

export const AgentConfigSchema = z.object({
  providers: z.record(z.string(), ProviderConfigSchema),
  defaultProvider: z.string(),
  fallbackProviders: z.array(z.string()).optional(),
  globalSettings: z.object({
    timeout: z.number(),
    maxRetries: z.number(),
    enableFallback: z.boolean(),
  }),
});
```

### Step 7: Integration Testing Framework

Create comprehensive tests for all providers:

```typescript
// src/tests/providers/integration.test.ts
import { ProviderFactory } from '../../providers/provider-factory';
import { ProviderConfig } from '../../types/provider-config';

describe('Provider Integration Tests', () => {
  const testConfigs: ProviderConfig[] = [
    {
      type: 'claude',
      name: 'Claude Test',
      apiKey: process.env.CLAUDE_API_KEY || 'test',
    },
    {
      type: 'openai',
      name: 'OpenAI Test',
      apiKey: process.env.OPENAI_API_KEY || 'test',
    },
    {
      type: 'ollama',
      name: 'Ollama Test',
      host: 'localhost',
      port: 11434,
    },
  ];

  testConfigs.forEach(config => {
    describe(`${config.type} Provider`, () => {
      let provider: any;

      beforeAll(async () => {
        if (!process.env[`${config.type.toUpperCase()}_API_KEY`] && config.type !== 'ollama') {
          return; // Skip if no API key provided
        }

        try {
          provider = await ProviderFactory.createProvider(config);
        } catch (error) {
          console.warn(`Skipping ${config.type} tests: ${error.message}`);
        }
      });

      test('should initialize successfully', () => {
        expect(provider).toBeDefined();
      });

      test('should validate configuration', () => {
        expect(provider.validateConfig()).toBe(true);
      });

      test('should return capabilities', () => {
        const capabilities = provider.getCapabilities();
        expect(capabilities).toHaveProperty('streaming');
        expect(capabilities).toHaveProperty('functionCalling');
      });

      test('should handle simple chat', async () => {
        if (!provider) return;

        const messages = [
          { role: 'user', content: 'Hello, world!' }
        ];

        const response = await provider.chat(messages);
        expect(response.choices).toHaveLength(1);
        expect(response.choices[0].message.content).toBeTruthy();
      });

      test('should handle streaming', async () => {
        if (!provider) return;

        const messages = [
          { role: 'user', content: 'Count from 1 to 3' }
        ];

        const chunks: any[] = [];
        const stream = provider.chatStream(messages);

        for await (const chunk of stream) {
          chunks.push(chunk);
          if (chunk.type === 'done') break;
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.some(chunk => chunk.type === 'content')).toBe(true);
      });
    });
  });
});
```

This phase delivers production-ready implementations for all major LLM providers, each handling their unique API characteristics while presenting a consistent interface through the universal abstraction layer established in Phase 1.

## Implementation Notes - OpenAI Provider Completion

**Provider Status**: ✅ **OPENAI PROVIDER COMPLETED** (2025-01-23 02:45)

### Key Implementation Details

**Decision**: Used OpenAI SDK v4 with proper streaming support  
**Reason**: Latest SDK provides robust type safety and streaming capabilities  
**Impact**: Full support for GPT-4o, GPT-4, GPT-3.5-turbo with vision and tool calling  
**Date**: 2025-01-23

**Decision**: Implemented incremental tool call buffering for streaming  
**Reason**: OpenAI streams tool calls in chunks that need to be accumulated  
**Impact**: Proper handling of complex tool calls in streaming scenarios  
**Date**: 2025-01-23

**Decision**: Dynamic model fetching with graceful fallback  
**Reason**: OpenAI frequently updates available models  
**Impact**: Always uses latest models while providing stable defaults  
**Date**: 2025-01-23

### Completed Implementation Files

- ✅ `src/providers/openai-provider.ts` - Full OpenAI provider implementation
- ✅ `src/providers/index.ts` - Updated with OpenAI provider registration
- ✅ Provider factory integration and validation
- ✅ Comprehensive error handling and retry logic
- ✅ Vision model support detection
- ✅ Organization and project ID support
- ✅ Token limit management per model

### Features Implemented

1. **Complete Model Support**
   - GPT-4o (128k context, vision)
   - GPT-4o-mini (cost-effective)
   - GPT-4-turbo (128k context, vision)
   - GPT-4 (8k context)
   - GPT-3.5-turbo (16k context)
   - Vision models (GPT-4o, GPT-4-turbo, GPT-4-vision-preview)

2. **Advanced Streaming**
   - Real-time content streaming
   - Incremental tool call accumulation
   - Proper chunk handling with null checks
   - Stream error recovery

3. **Tool Calling Support**
   - OpenAI function calling format
   - Multi-tool execution
   - Tool choice configuration
   - Streaming tool calls

4. **Configuration & Security**
   - API key validation
   - Organization/project ID support
   - Custom base URL support
   - Timeout and retry configuration
   - Error context preservation

5. **Additional Features**
   - Model information retrieval
   - Embedding support
   - Dynamic model list updates
   - Capability detection
   - Token limit awareness

### Testing Results

- ✅ Provider creation and initialization
- ✅ Configuration validation
- ✅ Model management and switching
- ✅ Capability detection
- ✅ Factory registration
- ✅ TypeScript compilation
- ✅ Build process

### Next Steps

With OpenAI provider complete, the universal architecture now supports:
- Multiple provider types (Grok, OpenAI)
- Dynamic provider switching
- Consistent tool calling across providers
- Unified streaming interface
- Provider capability detection

Ready for additional providers (Claude, Gemini, Ollama) or Phase 3 MCP integration.
