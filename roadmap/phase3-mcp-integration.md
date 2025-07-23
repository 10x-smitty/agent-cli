# Phase 3: MCP Tool Integration (Week 5-6)

## Phase Overview

This phase integrates Model Context Protocol (MCP) capabilities into the agent. MCP provides a standardized approach for tools and computations that can be accessed by LLMs, enabling AI to perform complex tasks dynamically by integrating these tools directly into the conversation workflow. The goal is to expand the agent's capability to use external tools seamlessly while maintaining a consistent interface.

Key deliverables include the implementation of MCP client, integration and registration of MCP tools, dynamic tool execution handling, and comprehensive integration testing.

## Development Prompt

```
Your objective is to incorporate MCP tool capabilities into a TypeScript CLI application.
1. Implement an MCP Client to connect to various MCP servers.
2. Integrate MCP tools within the existing tool execution framework without disrupting current functionalities.
3. Develop a dynamic tool registration system to allow seamless MCP tool discovery and usage.
4. Ensure robust error handling and tool execution logging.
5. Validate tool schemas and integrate authentication as required.
6. Test the implementation with diverse MCP tool scenarios, ensuring consistent performance across all configurations.
```

## Action Items Checklist

### MCP Client Development
- [ ] Create base MCP client structure
- [ ] Implement MCP server connection logic
- [ ] Develop tool discovery mechanism
- [ ] Support tool schema validation
- [ ] Integrate secure authentication methods
- [ ] Enable tool execution with response handling

### Tool Integration System
- [ ] Implement dynamic tool registry
- [ ] Integrate MCP tool execution within existing tool handling
- [ ] Develop configuration schema for MCP servers
- [ ] Set up system for automatic tool registration and updates
- [ ] Handle tool execution results and logging

### Enhanced Configuration 
- [ ] Add MCP configuration files
- [ ] Implement schema validation for MCP configs
- [ ] Develop configuration loading and merging logic

### Testing  Quality Assurance
- [ ] Unit test MCP client methods
- [ ] Integration test with sample MCP server
- [ ] Stress test with high volume tool requests
- [ ] Implement mock MCP server for CI testing
- [ ] Validate tool execution across multiple scenarios

## Detailed Implementation Guide

### Step 1: MCP Client Structure

Define the MCP Client Class:

```typescript
// src/mcp/mcp-client.ts
import { EventEmitter } from 'events';
import { MCPTool, MCPConnection } from '../types/mcp-types';
import fetch from 'node-fetch';

export class MCPClient extends EventEmitter {
  private connections: Map<string, MCPConnection> = new Map();

  async connectToServer(serverConfig: MCPServerConfig): Promise<void> {
    // Establish connection with the MCP server
    // Verify and store the connection
  }

  async listTools(serverId: string): Promise<MCPTool[]> {
    // Fetch available tools from a connected server ID
    // Handle potential errors and return tool list
  }

  async callTool(serverId: string, tool: string, params: any): Promise<MCPResult> {
    // Execute the specified tool with parameters
    // Return the result or handle errors
  }

  async listResources(serverId: string): Promise<MCPResource[]> {
    // List resources from a given MCP server
  }

  async readResource(serverId: string, uri: string): Promise<string> {
    // Access and return content from specified resource URI
  }
}
```

### Step 2: Dynamic Tool Registry

Implement registry supporting both internal and MCP tools:

```typescript
// src/tools/tool-registry.ts
import { MCPClient } from '../mcp/mcp-client';
import { Tool, MCPTool } from '../types/tool-types';

export class ToolRegistry {
  private staticTools: Map<string, Tool> = new Map();
  private mcpTools: Map<string, MCPTool> = new Map();
  private mcpClient: MCPClient;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  async loadMCPTools(serverId: string): Promise<void> {
    // Load tools from a specified MCP server
    // Store them in the MCP tool map
  }

  getTool(toolName: string): Tool | MCPTool | undefined {
    // Retrieve a tool by its name from either registry
  }

  async refreshAllTools(): Promise<void> {
    // Refresh tools from all connected MCP servers
  }
}
```

### Step 3: MCP Tool Execution

Handle execution within the current agent workflow:

```typescript
// src/agent/tool-executor.ts
import { ToolRegistry } from '../tools/tool-registry';
import { ToolResult, MCPToolCall } from '../types/tool-types';

export class ToolExecutor {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async executeToolCall(toolCall: MCPToolCall): Promise<ToolResult> {
    const tool = this.registry.getTool(toolCall.toolName);
    
    if (!tool) {
      return { success: false, error: 'Tool not found' };
    }

    try {
      return await tool.execute(toolCall.params);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

### Step 4: Enhanced Configuration

Define MCP configuration schema and loader:

```typescript
// src/config/mcp-config.ts
import { z } from 'zod';

const MCPServerConfigSchema = z.object({
  id: z.string(),
  url: z.string().url(),
});

export const MCPConfigSchema = z.object({
  servers: z.array(MCPServerConfigSchema),
});

export class MCPConfigLoader {
  static loadConfigFromFile(filePath: string): MCPConfig {
    // Load and validate config using zod
  }

  static mergeWithDefault(config: MCPConfig): MCPConfig {
    // Apply default settings to the given config
  }
}
```

### Step 5: Testing  Quality Assurance

Implement comprehensive testing for MCP integration:

```typescript
// src/tests/mcp/mcp-client.test.ts
import { MCPClient } from '../../mcp/mcp-client';

describe('MCPClient', () => {
  let mcpClient: MCPClient;

  beforeEach(() => {
    mcpClient = new MCPClient();
  });

  test('should connect to MCP server successfully', async () => {
    // Mock MCP server interactions
    await mcpClient.connectToServer({ id: 'test', url: 'http://localhost' });
    expect(mcpClient['connections'].size).toBe(1);
  });

  test('should list tools from server', async () => {
    const tools = await mcpClient.listTools('test');
    expect(tools).toEqual([]); // Use mock data to verify
  });

  test('should execute tool and handle responses', async () => {
    const result = await mcpClient.callTool('test', 'echo', { message: 'Hello' });
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });
});
```

This phase enhances the agent with the ability to interact with external tools via MCP, vastly expanding its functionality and adaptability to various complex tasks.
