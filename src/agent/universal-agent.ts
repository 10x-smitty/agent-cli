/**
 * Universal Agent Implementation
 * 
 * Main agent class that can work with multiple LLM providers
 * and switch between them dynamically based on model selection
 */

import { UniversalAgentBase } from './universal-agent-base';
import { BaseLLMProvider } from '../providers/base-provider';
import { GrokProvider } from '../providers/grok-provider';
import { OpenAIProvider } from '../providers/openai-provider';
import { ProviderFactory } from '../providers/provider-factory';
import { OpenAICompatibleConfig } from '../types/provider-config';
import { UniversalMessage, UniversalTool, UniversalToolCall, StreamingChunk } from '../types/llm-types';
import { GROK_TOOLS } from "../grok/tools";
import { TextEditorTool, BashTool, TodoTool, ConfirmationTool } from "../tools";
import { ToolResult } from "../types";
import { createTokenCounter, TokenCounter } from "../utils/token-counter";
import { loadCustomInstructions } from "../utils/custom-instructions";
import { MCPClient } from '../mcp/client';

// Backward compatibility interfaces
export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call" | "response";
  content: string;
  timestamp: Date;
  toolCalls?: UniversalToolCall[];
  toolCall?: UniversalToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
}

export interface StreamingChunkUI {
  type: "content" | "tool_calls" | "tool_result" | "response" | "done" | "token_count";
  content?: string;
  toolCalls?: UniversalToolCall[];
  toolCall?: UniversalToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
}

export class UniversalAgent extends UniversalAgentBase {
  private providers: Map<string, BaseLLMProvider> = new Map();
  private modelToProvider: Map<string, string> = new Map();
  
  // MCP client for universal tool execution
  private mcpClient: MCPClient;
  private tokenCounter: TokenCounter;
  private chatHistory: ChatEntry[] = [];

  constructor(grokApiKey: string, baseURL?: string) {
    // Initialize with Grok provider as default
    const grokConfig: OpenAICompatibleConfig = {
      type: 'grok',
      name: 'Grok',
      apiKey: grokApiKey,
      baseURL: baseURL || process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      timeout: 360000,
    };

    const grokProvider = new GrokProvider(grokConfig);
    super(grokProvider);

    // Initialize MCP client with tools
    this.mcpClient = new MCPClient(
      new TextEditorTool(),
      new BashTool(),
      new TodoTool(),
      new ConfirmationTool()
    );
    
    this.tokenCounter = createTokenCounter("grok-3-latest");

    // Initialize providers
    this.setupProviders(grokApiKey, baseURL);

    // Set up tools from MCP - we'll update this after MCP is initialized
    const universalTools: UniversalTool[] = GROK_TOOLS.map(tool => ({
      type: 'function' as const,
      function: tool.function,
    }));
    this.setTools(universalTools);

    // Initialize with system message
    this.initializeSystemMessage();

    // Initialize MCP and providers asynchronously
    this.initializeAsyncComponents();
  }

  private setupProviders(grokApiKey: string, baseURL?: string) {
    // Setup Grok provider
    const grokConfig: OpenAICompatibleConfig = {
      type: 'grok',
      name: 'Grok',
      apiKey: grokApiKey,
      baseURL: baseURL || process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      timeout: 360000,
    };
    const grokProvider = new GrokProvider(grokConfig);
    this.providers.set('grok', grokProvider);

    // Setup model mappings for Grok
    ['grok-4-latest', 'grok-3-latest', 'grok-3-fast', 'grok-3-mini-fast'].forEach(model => {
      this.modelToProvider.set(model, 'grok');
    });

    // Setup OpenAI provider if API key is available
    if (process.env.OPENAI_API_KEY) {
      const openAIConfig: OpenAICompatibleConfig = {
        type: 'openai',
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
        timeout: 60000,
      };
      const openAIProvider = new OpenAIProvider(openAIConfig);
      this.providers.set('openai', openAIProvider);

      // Setup model mappings for OpenAI
      ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'].forEach(model => {
        this.modelToProvider.set(model, 'openai');
      });
    }
  }

  private async initializeAsyncComponents() {
    // Initialize MCP client first
    try {
      await this.mcpClient.initialize();
    } catch (error: any) {
      console.warn('⚠️ Failed to initialize MCP client:', error.message);
    }

    // Initialize providers
    for (const [name, provider] of this.providers) {
      try {
        await provider.initialize();
        console.log(`✅ Initialized ${name} provider`);
      } catch (error: any) {
        console.warn(`⚠️ Failed to initialize ${name} provider:`, error.message);
        if (name !== 'grok') {
          // Remove failed providers (except Grok which is required)
          this.providers.delete(name);
        }
      }
    }
  }

  private initializeSystemMessage() {
    const customInstructions = loadCustomInstructions();
    const customInstructionsSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n\nThe above custom instructions should be followed alongside the standard instructions below.`
      : "";

    const systemMessage: UniversalMessage = {
      role: 'system',
      content: `You are an AI assistant that helps with file editing, coding tasks, and system operations.${customInstructionsSection}

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (ALWAYS use this to edit or update existing files)
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)
- create_todo_list: Create a visual todo list for planning and tracking tasks
- update_todo_list: Update existing todos in your todo list

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist - this will overwrite them completely
- ALWAYS use str_replace_editor to modify existing files, even for small changes
- Before editing a file, use view_file to see its current contents
- Use create_file ONLY when creating entirely new files that don't exist

Be helpful, direct, and efficient. Always explain what you're doing and show the results.

Current working directory: ${process.cwd()}`
    };

    this.addMessage(systemMessage);
  }

  /**
   * Switch to a different model, automatically changing providers if needed
   */
  async setModel(model: string): Promise<void> {
    const providerName = this.modelToProvider.get(model);
    
    if (!providerName) {
      throw new Error(`Unknown model: ${model}. Available models: ${Array.from(this.modelToProvider.keys()).join(', ')}`);
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not available. Please check your configuration.`);
    }

    // Switch provider if needed
    if (this.provider !== provider) {
      await this.switchProvider(provider);
    }

    // Set the model
    provider.setModel(model);

    // Update token counter
    this.tokenCounter.dispose();
    this.tokenCounter = createTokenCounter(model);
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.provider.getCurrentModel();
  }

  /**
   * Get available models from all providers
   */
  async getAllAvailableModels(): Promise<Array<{model: string, provider: string}>> {
    const models: Array<{model: string, provider: string}> = [];
    
    for (const [providerName, provider] of this.providers) {
      try {
        const providerModels = await provider.getAvailableModels();
        providerModels.forEach(model => {
          models.push({ model, provider: providerName });
        });
      } catch (error) {
        console.warn(`Failed to get models from ${providerName}:`, error);
      }
    }
    
    return models;
  }

  /**
   * Execute a tool call through the MCP client
   */
  private async executeUniversalTool(toolCall: UniversalToolCall): Promise<ToolResult> {
    try {
      // Validate that arguments is valid JSON before parsing
      let args: any;
      try {
        // Check if arguments string is complete and valid JSON
        if (!toolCall.function.arguments || typeof toolCall.function.arguments !== 'string') {
          throw new Error('Invalid or missing function arguments');
        }
        
        const argsStr = toolCall.function.arguments.trim();
        if (!argsStr.startsWith('{') || !argsStr.endsWith('}')) {
          throw new Error('Incomplete JSON arguments (streaming not complete)');
        }
        
        // Validate JSON completeness by checking bracket balance
        let braceCount = 0;
        let inString = false;
        let escaped = false;
        
        for (let i = 0; i < argsStr.length; i++) {
          const char = argsStr[i];
          
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
          throw new Error(`Incomplete JSON arguments (braces: ${braceCount}, inString: ${inString})`);
        }
        
        args = JSON.parse(argsStr);
      } catch (parseError: any) {
        return {
          success: false,
          error: `Invalid tool arguments: ${parseError.message}. Arguments received: "${toolCall.function.arguments?.substring(0, 100)}..."`
        };
      }
      
      const mcpResult = await this.mcpClient.callTool({
        name: toolCall.function.name,
        arguments: args
      });

      return {
        success: !mcpResult.isError,
        output: mcpResult.content.map(item => item.text || '').join('\n'),
        error: mcpResult.isError ? mcpResult.content.map(item => item.text || '').join('\n') : undefined
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  /**
   * Override tool handling to use our existing tool system
   */
  protected async *handleToolCalls(
    toolCalls: UniversalToolCall[]
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    for (const toolCall of toolCalls) {
      this.emit('tool-execution-started', toolCall);
      
      try {
        const result = await this.executeUniversalTool(toolCall);
        
        // Add tool result to conversation history 
        const toolResultMessage: UniversalMessage = {
          role: 'tool',
          content: result.success
            ? result.output || 'Success'
            : result.error || 'Error',
          tool_call_id: toolCall.id,
        };
        
        this.addMessage(toolResultMessage);
        
        // Yield the tool result
        yield {
          type: 'content',
          content: result.success
            ? result.output || 'Success'
            : `Error: ${result.error || 'Unknown error'}`,
        };
        
        this.emit('tool-execution-completed', toolCall, result);
      } catch (error: any) {
        const errorResult = {
          success: false,
          error: `Tool execution error: ${error.message}`,
        };
        
        yield {
          type: 'content',
          content: `Error executing ${toolCall.function.name}: ${error.message}`,
        };
        
        this.emit('tool-execution-completed', toolCall, errorResult);
      }
    }
  }

  // Backward compatibility methods for UI
  async *processUserMessageStreamUI(
    message: string
  ): AsyncGenerator<StreamingChunkUI, void, unknown> {
    let totalTokenCount = 0;

    for await (const chunk of this.processUserMessageStream(message)) {
      // Convert universal streaming chunk to UI format
      switch (chunk.type) {
        case 'content':
          if (chunk.content) {
            totalTokenCount += this.tokenCounter.estimateStreamingTokens(chunk.content);
            yield {
              type: 'content',
              content: chunk.content,
            };
            yield {
              type: 'token_count',
              tokenCount: totalTokenCount,
            };
          }
          break;

        case 'tool_calls':
          yield {
            type: 'tool_calls',
            toolCalls: chunk.tool_calls,
          };
          break;

        case 'response':
          if (chunk.content) {
            totalTokenCount += this.tokenCounter.estimateStreamingTokens(chunk.content);
            yield {
              type: 'response',
              content: chunk.content,
            };
            yield {
              type: 'token_count',
              tokenCount: totalTokenCount,
            };
          }
          break;

        case 'done':
          yield { type: 'done' };
          break;

        case 'error':
          yield {
            type: 'content',
            content: `Error: ${chunk.error}`,
          };
          yield { type: 'done' };
          break;
      }
    }
  }

  async processUserMessageUI(message: string): Promise<ChatEntry[]> {
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    const newEntries: ChatEntry[] = [userEntry];

    try {
      const response = await this.processUserMessage(message);
      
      const assistantEntry: ChatEntry = {
        type: "assistant",
        content: response.content || "I understand, but I don't have a specific response.",
        timestamp: new Date(),
        toolCalls: response.tool_calls,
      };
      
      this.chatHistory.push(assistantEntry);
      newEntries.push(assistantEntry);
      
      return newEntries;
    } catch (error: any) {
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      return [userEntry, errorEntry];
    }
  }

  // Other backward compatibility methods
  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return process.cwd(); // Use process.cwd() since we don't have direct bash access
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    // Execute through MCP client
    const mcpResult = await this.mcpClient.callTool({
      name: 'bash',
      arguments: { command }
    });
    
    return {
      success: !mcpResult.isError,
      output: mcpResult.content.map(item => item.text).join('\n'),
      error: mcpResult.isError ? mcpResult.content.map(item => item.text).join('\n') : undefined
    };
  }

  abortCurrentOperation(): void {
    // Implementation for aborting operations if needed
  }
}
