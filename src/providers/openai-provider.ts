import OpenAI from 'openai';
import { BaseLLMProvider } from './base-provider';
import { 
  UniversalMessage, 
  UniversalTool, 
  ChatResponse, 
  StreamingChunk,
  ProviderCapabilities
} from '../types/llm-types';
import { OpenAICompatibleConfig } from '../types/provider-config';

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;
  private availableModels = [
    'gpt-4o',
    'gpt-4o-mini', 
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'gpt-4-vision-preview',
    'gpt-4o-2024-08-06',
    'gpt-4-turbo-2024-04-09'
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

    // Fetch actual available models if possible
    try {
      const models = await this.client.models.list();
      const gptModels = models.data
        .filter(model => model.id.startsWith('gpt-'))
        .map(model => model.id)
        .sort();
      
      if (gptModels.length > 0) {
        this.availableModels = gptModels;
      }
    } catch (error) {
      console.warn('Could not fetch OpenAI models, using defaults:', error.message);
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
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4000,
        top_p: options?.topP ?? 1,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        presence_penalty: options?.presencePenalty ?? 0,
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
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4000,
        top_p: options?.topP ?? 1,
        frequency_penalty: options?.frequencyPenalty ?? 0,
        presence_penalty: options?.presencePenalty ?? 0,
        stream: true,
        ...options,
      }) as any; // Cast to any to handle stream typing

      let toolCallBuffer: { [key: string]: any } = {};

      for await (const chunk of stream) {
        const converted = this.convertOpenAIStreamChunk(chunk, toolCallBuffer);
        if (converted) {
          yield converted;
        }
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
      throw new Error(`Model ${model} not supported by OpenAI provider. Available models: ${this.availableModels.join(', ')}`);
    }
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCapabilities(): ProviderCapabilities {
    const isVisionModel = this.currentModel.includes('vision') || 
                          this.currentModel.includes('4o') ||
                          this.currentModel.includes('gpt-4-turbo');
    
    const maxTokens = this.getModelMaxTokens();
    
    return {
      streaming: true,
      functionCalling: true,
      vision: isVisionModel,
      maxTokens,
      supportedFormats: isVisionModel ? ['text', 'image'] : ['text'],
    };
  }

  validateConfig(): boolean {
    const config = this.config as OpenAICompatibleConfig;
    return !!(config.apiKey && config.type === 'openai');
  }

  private getModelMaxTokens(): number {
    if (this.currentModel.includes('gpt-4o')) return 128000;
    if (this.currentModel.includes('gpt-4-turbo')) return 128000;
    if (this.currentModel.includes('gpt-4')) return 8192;
    if (this.currentModel.includes('gpt-3.5-turbo')) return 16385;
    return 4000; // Default fallback
  }

  private formatOpenAIMessages(messages: UniversalMessage[]): any[] {
    return messages.map(message => {
      // Handle image content for vision models if needed
      if (message.role === 'user' && typeof message.content === 'string' && this.getCapabilities().vision) {
        // For now, just pass through string content
        // In future, we could add image URL parsing here
        return {
          role: message.role,
          content: message.content,
        };
      }

      return {
        role: message.role,
        content: message.content,
        tool_calls: message.tool_calls,
        tool_call_id: message.tool_call_id,
        name: message.name,
      };
    });
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
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };
  }

  private convertOpenAIStreamChunk(chunk: any, toolCallBuffer: { [key: string]: any }): StreamingChunk | null {
    const delta = chunk.choices?.[0]?.delta;
    
    if (!delta) {
      return null;
    }

    // Handle content streaming
    if (delta.content) {
      return {
        type: 'content',
        content: delta.content,
      };
    }

    // Handle tool calls streaming (OpenAI streams tool calls incrementally)
    if (delta.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        const index = toolCallDelta.index;
        
        if (!toolCallBuffer[index]) {
          toolCallBuffer[index] = {
            id: toolCallDelta.id || '',
            type: 'function',
            function: {
              name: toolCallDelta.function?.name || '',
              arguments: toolCallDelta.function?.arguments || '',
            },
          };
        } else {
          // Accumulate the tool call data
          if (toolCallDelta.function?.name) {
            toolCallBuffer[index].function.name += toolCallDelta.function.name;
          }
          if (toolCallDelta.function?.arguments) {
            toolCallBuffer[index].function.arguments += toolCallDelta.function.arguments;
          }
        }
      }

      // Check if we have complete tool calls with valid JSON
      const completedToolCalls = Object.values(toolCallBuffer).filter(
        (toolCall: any) => {
          if (!toolCall.function.name || !toolCall.function.arguments) {
            return false;
          }
          
          // Validate that arguments is complete JSON
          try {
            const args = toolCall.function.arguments.trim();
            if (!args.startsWith('{') || !args.endsWith('}')) {
              return false;
            }
            
            // Check bracket balance for JSON completeness
            let braceCount = 0;
            let inString = false;
            let escaped = false;
            
            for (let i = 0; i < args.length; i++) {
              const char = args[i];
              
              if (escaped) {
                escaped = false;
                continue;
              }
              
              if (char === '\\') {
                escaped = true;
                continue;
              }
              
              if (char === '"') {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
              }
            }
            
            if (braceCount !== 0 || inString) {
              return false;
            }
            
            // Try to parse JSON to ensure it's valid
            JSON.parse(args);
            return true;
          } catch {
            return false;
          }
        }
      );

      if (completedToolCalls.length > 0) {
        // Clear the buffer for completed tool calls to avoid duplicates
        completedToolCalls.forEach((completedCall: any) => {
          const bufferIndex = Object.keys(toolCallBuffer).find(
            key => toolCallBuffer[key] === completedCall
          );
          if (bufferIndex) {
            delete toolCallBuffer[bufferIndex];
          }
        });
        
        return {
          type: 'tool_calls',
          tool_calls: completedToolCalls,
        };
      }
    }

    // Handle completion
    if (chunk.choices?.[0]?.finish_reason) {
      return {
        type: 'done',
        finished_reason: chunk.choices[0].finish_reason,
      };
    }

    return null;
  }

  // Additional utility methods for OpenAI-specific features
  async getModelInfo(model?: string): Promise<any> {
    try {
      const targetModel = model || this.currentModel;
      return await this.client.models.retrieve(targetModel);
    } catch (error) {
      throw this.handleError(error, 'getModelInfo');
    }
  }

  async createEmbedding(input: string | string[], model = 'text-embedding-3-small'): Promise<any> {
    try {
      return await this.client.embeddings.create({
        model,
        input,
      });
    } catch (error) {
      throw this.handleError(error, 'createEmbedding');
    }
  }
}
