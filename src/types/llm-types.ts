/**
 * Universal LLM Types for Multi-Provider Support
 * 
 * This file defines the core interfaces that standardize communication
 * across different LLM providers (Grok, Claude, OpenAI, Gemini, etc.)
 */

/**
 * Universal message format that works across all LLM providers
 */
export interface UniversalMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: UniversalToolCall[];
  tool_call_id?: string;
  name?: string; // For tool response messages
}

/**
 * Universal tool call format supporting both function calls and MCP tools
 */
export interface UniversalToolCall {
  id: string;
  type: 'function' | 'mcp';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Universal tool definition supporting both static and MCP tools
 */
export interface UniversalTool {
  type: 'function' | 'mcp';
  function?: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
  mcp?: {
    server: string;
    tool: string;
    schema: any;
  };
}

/**
 * Streaming response chunk for real-time communication
 * Extended to support backward compatibility with existing UI
 */
export interface StreamingChunk {
  type: 'content' | 'tool_calls' | 'tool_result' | 'response' | 'done' | 'error' | 'token_count';
  content?: string;
  tool_calls?: UniversalToolCall[];
  error?: string;
  finished_reason?: string;
  // Backward compatibility properties
  toolCalls?: UniversalToolCall[]; // Alias for tool_calls
  toolCall?: UniversalToolCall; // For single tool call results
  toolResult?: { success: boolean; output?: string; error?: string; data?: any };
  tokenCount?: number; // For token counting support
}

/**
 * Standardized chat response format
 */
export interface ChatResponse {
  id: string;
  choices: Array<{
    message: UniversalMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Provider capability detection interface
 */
export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  maxTokens: number;
  supportedFormats: string[];
}
