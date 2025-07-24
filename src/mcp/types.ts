/**
 * MCP Types for Internal Bridge
 * 
 * These types define the MCP protocol structures we'll use
 * for our internal tool bridge implementation.
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: Record<string, any>;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPServerConfig {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'http' | 'websocket';
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}
