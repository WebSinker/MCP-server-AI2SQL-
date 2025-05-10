// File: mcpServer.js - Main MCP Server Implementation
const express = require('express');
const cors = require('cors');
const { EnhancedContextManager } = require('./enhancedContextManager');
const { ToolRegistry } = require('./toolRegistry');
const { processRequest } = require('./requestProcessor');
const { processNaturalLanguage } = require('./nlToSqlConverter');
const { executeQuery } = require('./dbConnector');
const { applyToMySQLWorkbench } = require('./mysqlWorkbenchConnector');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize MCP components
const contextManager = new EnhancedContextManager({
  expirationTime: 60 * 60 * 1000, // 1 hour
  maxContextSize: 8192,
  maxMessageHistory: 50
});

const toolRegistry = new ToolRegistry();

// Register SQL tools
toolRegistry.registerTool('sql_generator', {
  description: 'Converts natural language to SQL',
  parameters: {
    query: {
      type: 'string',
      description: 'The natural language query to convert to SQL'
    }
  },
  execute: async (params, context) => {
    const result = await processNaturalLanguage(params.query, {
      lastQuery: context.lastQuery,
      lastSql: context.lastSql
    });
    return result;
  }
});

toolRegistry.registerTool('sql_executor', {
  description: 'Executes SQL queries against the database',
  parameters: {
    sql: {
      type: 'string',
      description: 'The SQL query to execute'
    }
  },
  execute: async (params) => {
    return await executeQuery(params.sql);
  }
});

toolRegistry.registerTool('workbench_export', {
  description: 'Exports SQL to MySQL Workbench',
  parameters: {
    sql: {
      type: 'string',
      description: 'The SQL query to export'
    },
    scriptName: {
      type: 'string',
      description: 'Optional script name'
    }
  },
  execute: async (params) => {
    return await applyToMySQLWorkbench(params.sql, params.scriptName);
  }
});

// MCP API Endpoints
// 1. Chat endpoint
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { userId, messages, stream = false } = req.body;
    
    if (!userId || !messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request format' });
    }
    
    // Get user context
    const userContext = contextManager.getUserContext(userId);
    
    // Process the request
    const response = await processRequest(messages, userContext, toolRegistry);
    
    // Update context with new messages
    contextManager.updateContext(userId, {
      messageHistory: messages
    });
    
    res.json({
      id: `chat_${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'mcp-sql-assistant',
      choices: [{
        index: 0,
        message: response,
        finish_reason: 'stop'
      }]
    });
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Tools listing endpoint
app.get('/api/v1/tools', (req, res) => {
  const tools = toolRegistry.listTools();
  res.json({ tools });
});

// 3. Context management endpoint
app.post('/api/v1/context/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { action, data } = req.body;
    
    if (action === 'clear') {
      contextManager.clearContext(userId);
      res.json({ success: true, message: 'Context cleared' });
    } else if (action === 'update') {
      const updatedContext = contextManager.updateContext(userId, data);
      res.json({ success: true, context: updatedContext });
    } else if (action === 'get') {
      const context = contextManager.getUserContext(userId);
      res.json({ success: true, context });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Direct tool execution endpoint
app.post('/api/v1/tools/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const { userId, parameters } = req.body;
    
    if (!userId || !parameters) {
      return res.status(400).json({ error: 'Missing userId or parameters' });
    }
    
    const userContext = contextManager.getUserContext(userId);
    const result = await toolRegistry.executeTool(toolName, parameters, userContext);
    
    res.json({
      success: true,
      tool: toolName,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  
  // Set up context cleanup timer
  setInterval(() => {
    contextManager.cleanupExpiredContexts();
  }, 15 * 60 * 1000); // Run every 15 minutes
});

module.exports = app;