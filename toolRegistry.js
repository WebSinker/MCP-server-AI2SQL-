// File: toolRegistry.js
class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  // Register a new tool
  registerTool(toolName, toolSpec) {
    if (this.tools.has(toolName)) {
      throw new Error(`Tool with name ${toolName} already exists`);
    }

    this.tools.set(toolName, {
      name: toolName,
      description: toolSpec.description || '',
      parameters: toolSpec.parameters || {},
      execute: toolSpec.execute,
    });

    return this;
  }

  // Get a tool by name
  getTool(toolName) {
    if (!this.tools.has(toolName)) {
      throw new Error(`Tool with name ${toolName} not found`);
    }

    return this.tools.get(toolName);
  }

  // List all available tools
  listTools() {
    const toolsList = [];
    
    for (const [name, tool] of this.tools.entries()) {
      toolsList.push({
        name: name,
        description: tool.description,
        parameters: tool.parameters
      });
    }
    
    return toolsList;
  }

  // Execute a tool
  async executeTool(toolName, params, context) {
    const tool = this.getTool(toolName);
    return await tool.execute(params, context);
  }
}

module.exports = { ToolRegistry };