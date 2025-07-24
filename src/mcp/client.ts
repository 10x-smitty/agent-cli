/**
 * MCP Client
 * 
 * This client currently works with:
 * 1. Internal MCP Bridge (wrapping existing tools)
 * 
 * Future versions will support external MCP servers.
 * This provides a unified interface for all tool execution.
 */

import { MCPInternalBridge } from './internal-bridge';
import { MCPTool, MCPToolCall, MCPResult } from './types';
import { TextEditorTool, BashTool, TodoTool, ConfirmationTool } from '../tools';

export class MCPClient {
  private internalBridge: MCPInternalBridge;
  private allTools = new Map<string, {
    source: 'internal';
    schema: MCPTool;
  }>();

  constructor(
    textEditor: TextEditorTool,
    bashTool: BashTool,
    todoTool: TodoTool,
    confirmationTool: ConfirmationTool
  ) {
    // Initialize internal bridge with existing tools
    this.internalBridge = new MCPInternalBridge(
      textEditor,
      bashTool,
      todoTool,
      confirmationTool
    );

    // Load internal tools into the unified tool registry
    this.loadInternalTools();
  }

  /**
   * Initialize the MCP client system
   */
  async initialize(): Promise<void> {
    // Internal bridge is already initialized
    console.log('✅ MCP Internal Bridge initialized');
    
    // Log available tools
    const toolNames = this.getToolNames();
    console.log(`📋 Available tools: ${toolNames.join(', ')}`);
  }

  /**
   * Load internal tools into the unified registry
   */
  private async loadInternalTools(): Promise<void> {
    const internalTools = await this.internalBridge.listTools();
    
    for (const tool of internalTools) {
      this.allTools.set(tool.name, {
        source: 'internal',
        schema: tool
      });
    }

    console.log(`📋 Loaded ${internalTools.length} internal tools:`, 
      internalTools.map(t => t.name).join(', '));
  }


  /**
   * List all available tools from all sources
   */
  async listAllTools(): Promise<MCPTool[]> {
    return Array.from(this.allTools.values()).map(tool => tool.schema);
  }

  /**
   * Execute a tool call, routing to the appropriate source
   */
  async callTool(toolCall: MCPToolCall): Promise<MCPResult> {
    const toolInfo = this.allTools.get(toolCall.name);
    
    if (!toolInfo) {
      return {
        content: [{
          type: 'text',
          text: `Error: Tool '${toolCall.name}' not found. Available tools: ${Array.from(this.allTools.keys()).join(', ')}`
        }],
        isError: true
      };
    }

    try {
      // Always use internal bridge for now
      return await this.internalBridge.callTool(toolCall);
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error executing tool '${toolCall.name}': ${error.message}`
        }],
        isError: true,
        _meta: {
          error: error.stack,
          source: toolInfo.source
        }
      };
    }
  }

  /**
   * Get tool schema by name
   */
  getToolSchema(toolName: string): MCPTool | null {
    const toolInfo = this.allTools.get(toolName);
    return toolInfo ? toolInfo.schema : null;
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.allTools.has(toolName);
  }

  /**
   * Get all available tool names
   */
  getToolNames(): string[] {
    return Array.from(this.allTools.keys());
  }

  /**
   * Get tools by source
   */
  getToolsBySource(source: string): MCPTool[] {
    return Array.from(this.allTools.values())
      .filter(tool => tool.source === source)
      .map(tool => tool.schema);
  }

  /**
   * Get connection status
   */
  getStatus(): {
    internal: boolean;
    toolCount: number;
  } {
    return {
      internal: true,
      toolCount: this.allTools.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Clear internal registry
    this.allTools.clear();
    console.log('🔌 MCP Client cleaned up');
  }
}
