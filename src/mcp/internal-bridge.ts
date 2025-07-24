/**
 * Internal MCP Bridge
 * 
 * This class wraps the existing tool implementations (TextEditorTool, BashTool, etc.)
 * with a MCP-compatible interface. This allows us to use the MCP protocol internally
 * while maintaining all existing functionality and avoiding the JSON parsing issues
 * with provider-specific tool calling.
 */

import { TextEditorTool, BashTool, TodoTool, ConfirmationTool } from '../tools';
import { ToolResult } from '../types';
import { MCPTool, MCPToolCall, MCPResult } from './types';

export class MCPInternalBridge {
  private tools = new Map<string, {
    handler: Function;
    schema: MCPTool;
  }>();

  constructor(
    private textEditor: TextEditorTool,
    private bashTool: BashTool,
    private todoTool: TodoTool,
    private confirmationTool: ConfirmationTool
  ) {
    this.registerAllTools();
  }

  private registerAllTools(): void {
    // File viewing tool
    this.registerTool({
      name: 'view_file',
      description: 'View the contents of a file or list directory contents',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file or directory to view'
          },
          start_line: {
            type: 'number',
            description: 'Starting line number for partial file viewing (optional)'
          },
          end_line: {
            type: 'number', 
            description: 'Ending line number for partial file viewing (optional)'
          }
        },
        required: ['path']
      }
    }, async (args: any) => {
      const range: [number, number] | undefined = 
        args.start_line && args.end_line ? [args.start_line, args.end_line] : undefined;
      return await this.textEditor.view(args.path, range);
    });

    // File creation tool
    this.registerTool({
      name: 'create_file',
      description: 'Create a new file with the specified content',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path where the new file should be created'
          },
          content: {
            type: 'string',
            description: 'Content to write to the new file'
          }
        },
        required: ['path', 'content']
      }
    }, async (args: any) => {
      return await this.textEditor.create(args.path, args.content);
    });

    // String replacement tool
    this.registerTool({
      name: 'str_replace_editor',
      description: 'Replace text in an existing file using string replacement',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to edit'
          },
          old_str: {
            type: 'string',
            description: 'The exact string to be replaced'
          },
          new_str: {
            type: 'string',
            description: 'The string to replace with'
          },
          replace_all: {
            type: 'boolean',
            description: 'Whether to replace all occurrences (default: false)',
            default: false
          }
        },
        required: ['path', 'old_str', 'new_str']
      }
    }, async (args: any) => {
      return await this.textEditor.strReplace(
        args.path,
        args.old_str,
        args.new_str,
        args.replace_all || false
      );
    });

    // Bash execution tool
    this.registerTool({
      name: 'bash',
      description: 'Execute bash commands in the terminal',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute'
          }
        },
        required: ['command']
      }
    }, async (args: any) => {
      return await this.bashTool.execute(args.command);
    });

    // Todo list creation tool
    this.registerTool({
      name: 'create_todo_list',
      description: 'Create a visual todo list for planning and tracking tasks',
      inputSchema: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string' },
                completed: { type: 'boolean' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['task']
            },
            description: 'Array of todo items to create'
          }
        },
        required: ['todos']
      }
    }, async (args: any) => {
      return await this.todoTool.createTodoList(args.todos);
    });

    // Todo list update tool
    this.registerTool({
      name: 'update_todo_list',
      description: 'Update existing todos in your todo list',
      inputSchema: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                task: { type: 'string' },
                completed: { type: 'boolean' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['id']
            },
            description: 'Array of todo updates to apply'
          }
        },
        required: ['updates']
      }
    }, async (args: any) => {
      return await this.todoTool.updateTodoList(args.updates);
    });
  }

  private registerTool(schema: MCPTool, handler: Function): void {
    this.tools.set(schema.name, { handler, schema });
  }

  /**
   * List all available tools with their schemas
   */
  async listTools(): Promise<MCPTool[]> {
    return Array.from(this.tools.values()).map(tool => tool.schema);
  }

  /**
   * Execute a tool call using MCP protocol
   */
  async callTool(toolCall: MCPToolCall): Promise<MCPResult> {
    const toolInfo = this.tools.get(toolCall.name);
    
    if (!toolInfo) {
      return {
        content: [{
          type: 'text',
          text: `Error: Tool '${toolCall.name}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`
        }],
        isError: true
      };
    }

    try {
      // Validate arguments against schema (basic validation)
      const validation = this.validateArguments(toolCall.arguments, toolInfo.schema.inputSchema);
      if (!validation.valid) {
        return {
          content: [{
            type: 'text',
            text: `Error: Invalid arguments for tool '${toolCall.name}': ${validation.error}`
          }],
          isError: true
        };
      }

      // Execute the tool
      const result: ToolResult = await toolInfo.handler(toolCall.arguments);
      
      // Convert ToolResult to MCPResult
      return this.convertToolResultToMCP(result);
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error executing tool '${toolCall.name}': ${error.message}`
        }],
        isError: true,
        _meta: {
          error: error.stack
        }
      };
    }
  }

  /**
   * Get tool schema by name
   */
  getToolSchema(toolName: string): MCPTool | null {
    const toolInfo = this.tools.get(toolName);
    return toolInfo ? toolInfo.schema : null;
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all available tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Basic argument validation against schema
   */
  private validateArguments(args: Record<string, any>, schema: any): { valid: boolean; error?: string } {
    // Check required fields
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in args)) {
          return {
            valid: false,
            error: `Missing required field: ${requiredField}`
          };
        }
      }
    }

    // Basic type checking for properties
    if (schema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(schema.properties as Record<string, any>)) {
        if (fieldName in args) {
          const value = args[fieldName];
          const expectedType = fieldSchema.type;
          
          if (expectedType === 'string' && typeof value !== 'string') {
            return { valid: false, error: `Field '${fieldName}' must be a string` };
          }
          if (expectedType === 'number' && typeof value !== 'number') {
            return { valid: false, error: `Field '${fieldName}' must be a number` };
          }
          if (expectedType === 'boolean' && typeof value !== 'boolean') {
            return { valid: false, error: `Field '${fieldName}' must be a boolean` };
          }
          if (expectedType === 'array' && !Array.isArray(value)) {
            return { valid: false, error: `Field '${fieldName}' must be an array` };
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Convert ToolResult to MCPResult format
   */
  private convertToolResultToMCP(result: ToolResult): MCPResult {
    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: result.output || 'Success'
        }],
        isError: false
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: result.error || 'Unknown error occurred'
        }],
        isError: true
      };
    }
  }
}
