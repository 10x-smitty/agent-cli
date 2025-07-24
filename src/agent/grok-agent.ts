import { UniversalAgentBase } from './universal-agent-base';
import { GrokProvider } from '../providers/grok-provider';
import { OpenAIProvider } from '../providers/openai-provider';
import { ProviderFactory } from '../providers/provider-factory';
import { OpenAICompatibleConfig } from '../types/provider-config';
import { UniversalMessage, UniversalTool, UniversalToolCall, StreamingChunk as UniversalStreamingChunk } from '../types/llm-types';
import { GrokClient, GrokToolCall, GrokMessage } from '../grok/client';
import { GROK_TOOLS } from "../grok/tools";
import { TextEditorTool, BashTool, TodoTool, ConfirmationTool } from "../tools";
import { ToolResult } from "../types";
import { createTokenCounter, TokenCounter } from "../utils/token-counter";
import { loadCustomInstructions } from "../utils/custom-instructions";
import { BaseLLMProvider } from '../providers/base-provider';

// Backward compatibility interfaces - kept for existing integrations
export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  timestamp: Date;
  toolCalls?: UniversalToolCall[];
  toolCall?: UniversalToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
}

export interface StreamingChunk {
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count";
  content?: string;
  toolCalls?: UniversalToolCall[];
  toolCall?: UniversalToolCall;
  toolResult?: ToolResult;
  tokenCount?: number;
}

/**
 * GrokAgent - Refactored to use Universal Architecture
 * 
 * This class maintains full backward compatibility while leveraging
 * the new provider abstraction system for future extensibility.
 */
export class GrokAgent extends UniversalAgentBase {
  // Backward compatibility - these properties are kept for existing integrations  
  private textEditor: TextEditorTool;
  private bash: BashTool;
  private todoTool: TodoTool;
  private confirmationTool: ConfirmationTool;
  private chatHistory: ChatEntry[] = [];
  private tokenCounter: TokenCounter;
  private abortController: AbortController | null = null;
  private legacyMessages: GrokMessage[] = []; // For backward compatibility
  private grokClient: GrokClient; // Direct client access for streaming
  private currentProvider: BaseLLMProvider;
  private grokProvider: GrokProvider;
  private openAIProvider: OpenAIProvider | null = null;

  constructor(apiKey: string, baseURL?: string) {
    // Create the GrokProvider and initialize the base class
    const grokConfig: OpenAICompatibleConfig = {
      type: 'grok',
      name: 'Grok',
      apiKey: apiKey,
      baseURL: baseURL || process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
      timeout: 360000,
    };

    // Create provider instance
    const provider = new GrokProvider(grokConfig);
    
    // Initialize base class with provider
    super(provider);
    
    // Store provider references
    this.grokProvider = provider;
    this.currentProvider = provider;
    
    // Initialize OpenAI provider if API key is available
    if (process.env.OPENAI_API_KEY) {
      const openAIConfig: OpenAICompatibleConfig = {
        type: 'openai',
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
        timeout: 60000,
      };
      this.openAIProvider = new OpenAIProvider(openAIConfig);
      // Initialize the OpenAI provider
      this.openAIProvider.initialize().catch(error => {
        console.warn('Failed to initialize OpenAI provider:', error.message);
        this.openAIProvider = null;
      });
    }

    // Initialize tool instances
    this.textEditor = new TextEditorTool();
    this.bash = new BashTool();
    this.todoTool = new TodoTool();
    this.confirmationTool = new ConfirmationTool();
    this.tokenCounter = createTokenCounter("grok-4-latest");
    
    // Initialize grok client for backward compatibility streaming
    this.grokClient = new GrokClient(apiKey, undefined, baseURL);

    // Convert GROK_TOOLS to UniversalTool format and set them
    const universalTools: UniversalTool[] = GROK_TOOLS.map(tool => ({
      type: 'function' as const,
      function: tool.function,
    }));
    
    this.setTools(universalTools);

    // Initialize provider asynchronously  
    provider.initialize().catch(error => {
      console.error('Failed to initialize Grok provider:', error);
    });

    // Initialize system message for the universal agent
    const customInstructions = loadCustomInstructions();
    const customInstructionsSection = customInstructions
      ? `\n\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n\nThe above custom instructions should be followed alongside the standard instructions below.`
      : "";

    const systemMessage: UniversalMessage = {
      role: 'system',
      content: `You are Grok CLI, an AI assistant that helps with file editing, coding tasks, and system operations.${customInstructionsSection}

You have access to these tools:
- view_file: View file contents or directory listings
- create_file: Create new files with content (ONLY use this for files that don't exist yet)
- str_replace_editor: Replace text in existing files (ALWAYS use this to edit or update existing files)
- bash: Execute bash commands (use for searching, file discovery, navigation, and system operations)
- create_todo_list: Create a visual todo list for planning and tracking tasks
- update_todo_list: Update existing todos in your todo list

REAL-TIME INFORMATION:
You have access to real-time web search and X (Twitter) data. When users ask for current information, latest news, or recent events, you automatically have access to up-to-date information from the web and social media.

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist - this will overwrite them completely
- ALWAYS use str_replace_editor to modify existing files, even for small changes
- Before editing a file, use view_file to see its current contents
- Use create_file ONLY when creating entirely new files that don't exist

SEARCHING AND EXPLORATION:
- Use bash with commands like 'find', 'grep', 'rg' (ripgrep), 'ls', etc. for searching files and content
- Examples: 'find . -name "*.js"', 'grep -r "function" src/', 'rg "import.*react"'
- Use bash for directory navigation, file discovery, and content searching
- view_file is best for reading specific files you already know exist

When a user asks you to edit, update, modify, or change an existing file:
1. First use view_file to see the current contents
2. Then use str_replace_editor to make the specific changes
3. Never use create_file for existing files

When a user asks you to create a new file that doesn't exist:
1. Use create_file with the full content

TASK PLANNING WITH TODO LISTS:
- For complex requests with multiple steps, ALWAYS create a todo list first to plan your approach
- Use create_todo_list to break down tasks into manageable items with priorities
- Mark tasks as 'in_progress' when you start working on them (only one at a time)
- Mark tasks as 'completed' immediately when finished
- Use update_todo_list to track your progress throughout the task
- Todo lists provide visual feedback with colors: ✅ Green (completed), 🔄 Cyan (in progress), ⏳ Yellow (pending)
- Always create todos with priorities: 'high' (🔴), 'medium' (🟡), 'low' (🟢)

USER CONFIRMATION SYSTEM:
File operations (create_file, str_replace_editor) and bash commands will automatically request user confirmation before execution. The confirmation system will show users the actual content or command before they decide. Users can choose to approve individual operations or approve all operations of that type for the session.

If a user rejects an operation, the tool will return an error and you should not proceed with that specific operation.

Be helpful, direct, and efficient. Always explain what you're doing and show the results.

IMPORTANT RESPONSE GUIDELINES:
- After using tools, do NOT respond with pleasantries like "Thanks for..." or "Great!"
- Only provide necessary explanations or next steps if relevant to the task
- Keep responses concise and focused on the actual work being done
- If a tool execution completes the user's request, you can remain silent or give a brief confirmation

Current working directory: ${process.cwd()}`
    };

    // Initialize universal agent with system message
    this.addMessage(systemMessage);
  }

  /**
   * Backward compatible method that uses the new universal architecture
   * Returns ChatEntry format for existing integrations
   */
  async processUserMessageLegacy(message: string): Promise<ChatEntry[]> {
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    const newEntries: ChatEntry[] = [userEntry];

    try {
      // Use the universal agent's processUserMessage method
      const response = await super.processUserMessage(message);
      
      // Convert UniversalMessage response to ChatEntry format for backward compatibility
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

  /**
   * Override the base class tool handling with our existing tool implementations
   * This ensures backward compatibility with existing tool system
   */
  protected async *handleToolCalls(
    toolCalls: UniversalToolCall[]
  ): AsyncGenerator<import('../types/llm-types').StreamingChunk, void, unknown> {
    for (const toolCall of toolCalls) {
      this.emit('tool-execution-started', toolCall);
      
      try {
        // Execute the tool using our existing system
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
        
        // Yield the tool result for streaming interface
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

  /**
   * Execute a universal tool call using our existing tool implementations
   */
  private async executeUniversalTool(toolCall: UniversalToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolCall.function.name) {
        case "view_file":
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);

        case "create_file":
          return await this.textEditor.create(args.path, args.content);

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str,
            args.replace_all
          );

        case "bash":
          return await this.bash.execute(args.command);

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  /**
   * Accumulates partial message content from streaming responses
   */
  private messageReducer(previous: any, item: any): any {
    const reduce = (acc: any, delta: any) => {
      acc = { ...acc };
      for (const [key, value] of Object.entries(delta)) {
        if (acc[key] === undefined || acc[key] === null) {
          acc[key] = value;
          // Clean up index properties from tool calls
          if (Array.isArray(acc[key])) {
            for (const arr of acc[key]) {
              delete arr.index;
            }
          }
        } else if (typeof acc[key] === "string" && typeof value === "string") {
          (acc[key] as string) += value;
        } else if (Array.isArray(acc[key]) && Array.isArray(value)) {
          const accArray = acc[key] as any[];
          for (let i = 0; i < value.length; i++) {
            if (!accArray[i]) accArray[i] = {};
            accArray[i] = reduce(accArray[i], value[i]);
          }
        } else if (typeof acc[key] === "object" && typeof value === "object") {
          acc[key] = reduce(acc[key], value);
        }
      }
      return acc;
    };

    return reduce(previous, item.choices[0]?.delta || {});
  }

  /**
   * Backward compatible streaming method using universal architecture where possible
   * but maintaining existing token counting and UI feedback
   */
  async *processUserMessageStreamLegacy(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Create new abort controller for this request
    this.abortController = new AbortController();

    // Add user message to conversation
    const userEntry: ChatEntry = {
      type: "user",
      content: message,
      timestamp: new Date(),
    };
    this.chatHistory.push(userEntry);
    this.legacyMessages.push({ role: "user", content: message });

    // Calculate input tokens
    const inputTokens = this.tokenCounter.countMessageTokens(
      this.legacyMessages as any
    );
    yield {
      type: "token_count",
      tokenCount: inputTokens,
    };

    const maxToolRounds = 30; // Prevent infinite loops
    let toolRounds = 0;
    let totalOutputTokens = 0;

    try {
      // Agent loop - continue until no more tool calls or max rounds reached
      while (toolRounds < maxToolRounds) {
        // Check if operation was cancelled
        if (this.abortController?.signal.aborted) {
          yield {
            type: "content",
            content: "\n\n[Operation cancelled by user]",
          };
          yield { type: "done" };
          return;
        }

        // Stream response and accumulate
        const stream = this.grokClient.chatStream(
          this.legacyMessages,
          GROK_TOOLS,
          undefined,
          { search_parameters: { mode: "auto" } }
        );
        let accumulatedMessage: any = {};
        let accumulatedContent = "";
        let toolCallsYielded = false;

        for await (const chunk of stream) {
          // Check for cancellation in the streaming loop
          if (this.abortController?.signal.aborted) {
            yield {
              type: "content",
              content: "\n\n[Operation cancelled by user]",
            };
            yield { type: "done" };
            return;
          }

          if (!chunk.choices?.[0]) continue;

          // Accumulate the message using reducer
          accumulatedMessage = this.messageReducer(accumulatedMessage, chunk);

          // Check for tool calls - yield when we have complete tool calls with function names
          if (!toolCallsYielded && accumulatedMessage.tool_calls?.length > 0) {
            // Check if we have at least one complete tool call with a function name
            const hasCompleteTool = accumulatedMessage.tool_calls.some(
              (tc: any) => tc.function?.name
            );
            if (hasCompleteTool) {
              yield {
                type: "tool_calls",
                toolCalls: accumulatedMessage.tool_calls,
              };
              toolCallsYielded = true;
            }
          }

          // Stream content as it comes
          if (chunk.choices[0].delta?.content) {
            accumulatedContent += chunk.choices[0].delta.content;

            // Update token count in real-time
            const currentOutputTokens =
              this.tokenCounter.estimateStreamingTokens(accumulatedContent);
            totalOutputTokens = currentOutputTokens;

            yield {
              type: "content",
              content: chunk.choices[0].delta.content,
            };

            // Emit token count update
            yield {
              type: "token_count",
              tokenCount: inputTokens + totalOutputTokens,
            };
          }
        }

        // Add assistant entry to history
        const assistantEntry: ChatEntry = {
          type: "assistant",
          content: accumulatedMessage.content || "Using tools to help you...",
          timestamp: new Date(),
          toolCalls: accumulatedMessage.tool_calls || undefined,
        };
        this.chatHistory.push(assistantEntry);

        // Add accumulated message to conversation
        this.legacyMessages.push({
          role: "assistant",
          content: accumulatedMessage.content || "",
          tool_calls: accumulatedMessage.tool_calls,
        } as any);

        // Handle tool calls if present
        if (accumulatedMessage.tool_calls?.length > 0) {
          toolRounds++;

          // Only yield tool_calls if we haven't already yielded them during streaming
          if (!toolCallsYielded) {
            yield {
              type: "tool_calls",
              toolCalls: accumulatedMessage.tool_calls,
            };
          }

          // Execute tools
          for (const toolCall of accumulatedMessage.tool_calls) {
            // Check for cancellation before executing each tool
            if (this.abortController?.signal.aborted) {
              yield {
                type: "content",
                content: "\n\n[Operation cancelled by user]",
              };
              yield { type: "done" };
              return;
            }

            const result = await this.executeTool(toolCall);

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            this.chatHistory.push(toolResultEntry);

            yield {
              type: "tool_result",
              toolCall,
              toolResult: result,
            };

            // Add tool result with proper format (needed for AI context)
            this.legacyMessages.push({
              role: "tool",
              content: result.success
                ? result.output || "Success"
                : result.error || "Error",
              tool_call_id: toolCall.id,
            });
          }

          // Continue the loop to get the next response (which might have more tool calls)
        } else {
          // No tool calls, we're done
          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        yield {
          type: "content",
          content:
            "\n\nMaximum tool execution rounds reached. Stopping to prevent infinite loops.",
        };
      }

      yield { type: "done" };
    } catch (error: any) {
      // Check if this was a cancellation
      if (this.abortController?.signal.aborted) {
        yield {
          type: "content",
          content: "\n\n[Operation cancelled by user]",
        };
        yield { type: "done" };
        return;
      }

      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      this.chatHistory.push(errorEntry);
      yield {
        type: "content",
        content: errorEntry.content,
      };
      yield { type: "done" };
    } finally {
      // Clean up abort controller
      this.abortController = null;
    }
  }

  private async executeTool(toolCall: GrokToolCall): Promise<ToolResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);

      switch (toolCall.function.name) {
        case "view_file":
          const range: [number, number] | undefined =
            args.start_line && args.end_line
              ? [args.start_line, args.end_line]
              : undefined;
          return await this.textEditor.view(args.path, range);

        case "create_file":
          return await this.textEditor.create(args.path, args.content);

        case "str_replace_editor":
          return await this.textEditor.strReplace(
            args.path,
            args.old_str,
            args.new_str,
            args.replace_all
          );

        case "bash":
          return await this.bash.execute(args.command);

        case "create_todo_list":
          return await this.todoTool.createTodoList(args.todos);

        case "update_todo_list":
          return await this.todoTool.updateTodoList(args.updates);

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolCall.function.name}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }

  getCurrentDirectory(): string {
    return this.bash.getCurrentDirectory();
  }

  async executeBashCommand(command: string): Promise<ToolResult> {
    return await this.bash.execute(command);
  }

  getCurrentModel(): string {
    return this.currentProvider.getCurrentModel();
  }

  async setModel(model: string): Promise<void> {
    try {
      // Determine which provider this model belongs to
      const isGrokModel = ['grok-4-latest', 'grok-3-latest', 'grok-3-fast', 'grok-3-mini-fast'].includes(model);
      const isOpenAIModel = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'].includes(model);
      
      if (isGrokModel) {
        // Switch to Grok provider
        this.currentProvider = this.grokProvider;
        this.grokClient.setModel(model);
        this.grokProvider.setModel(model);
        // Update the base class provider
        this.provider = this.grokProvider;
      } else if (isOpenAIModel && this.openAIProvider) {
        // Switch to OpenAI provider
        this.currentProvider = this.openAIProvider;
        this.openAIProvider.setModel(model);
        // Update the base class provider
        this.provider = this.openAIProvider;
      } else {
        throw new Error(`Unsupported model: ${model}. Please ensure the corresponding provider is configured.`);
      }
      
      // Update token counter for new model
      this.tokenCounter.dispose();
      this.tokenCounter = createTokenCounter(model);
      
    } catch (error: any) {
      throw new Error(`Failed to switch to model ${model}: ${error.message}`);
    }
  }

  abortCurrentOperation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Backward compatibility aliases for existing UI code
  async processUserMessageUI(message: string): Promise<ChatEntry[]> {
    return this.processUserMessageLegacy(message);
  }

  async *processUserMessageStreamUI(
    message: string
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    yield* this.processUserMessageStreamLegacy(message);
  }
}
