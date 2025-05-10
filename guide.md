# AI Integration Guide for MCP Server

This guide explains how to integrate various AI systems with your MCP server to enable natural language to SQL conversion.

## Table of Contents
1. [Integration Overview](#integration-overview)
2. [OpenAI GPT Integration](#openai-gpt-integration)
3. [Google Gemini Integration](#google-gemini-integration)
4. [LangChain Integration](#langchain-integration)
5. [Claude/Anthropic Integration](#claudeanthropic-integration)
6. [Custom LLM Integration](#custom-llm-integration)
7. [Creating AI Applications](#creating-ai-applications)
8. [Integration Testing](#integration-testing)

## Integration Overview

Your MCP server exposes the following API endpoints that AI systems can use:

- **`POST /api/v1/chat`** - Main conversation endpoint
- **`GET /api/v1/tools`** - Lists available tools
- **`POST /api/v1/context/:userId`** - Manages user context
- **`POST /api/v1/tools/:toolName`** - Direct tool execution

AI systems can integrate with your MCP server in two primary ways:

1. **As a tool or function calling capability** - The AI calls your MCP server to process natural language into SQL
2. **As a routing layer** - The AI determines when to use the MCP server and forwards appropriate requests

## OpenAI GPT Integration

The OpenAI GPT models can use your MCP server through function calling to convert natural language queries into SQL statements. This approach allows you to leverage GPT's understanding while using your specialized MCP server for accurate SQL generation.

### Using Function Calling with GPT-4

```javascript
const { OpenAI }

## Google Gemini Integration

You can integrate your MCP server with Google's Gemini models using their function calling capabilities:

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// MCP Server configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';

// Function to process natural language to SQL using MCP server
async function processNaturalLanguageToSQL(query, userId) {
  try {
    const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_generator`, {
      userId,
      parameters: {
        query
      }
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error calling MCP server:', error);
    throw new Error(`Failed to convert query to SQL: ${error.message}`);
  }
}

// Example: Using Gemini with MCP server
async function answerDatabaseQuestionWithGemini(question, userId) {
  // Get a generative model
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  // Configure the chat
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "You are a database assistant that can answer questions by converting them to SQL." }]
      },
      {
        role: "model",
        parts: [{ text: "I'll help you answer database questions by converting them to SQL queries." }]
      }
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: "convert_to_sql",
            description: "Converts a natural language question into a SQL query",
            parameters: {
              type: "OBJECT",
              properties: {
                query: {
                  type: "STRING",
                  description: "The natural language question to convert to SQL"
                }
              },
              required: ["query"]
            }
          }
        ]
      }
    ]
  });

  // Send user question
  const result = await chat.sendMessage(question);
  const response = await result.response;
  
  // Check if there's a function call
  if (response.functionCalls && response.functionCalls.length > 0) {
    const functionCall = response.functionCalls[0];
    
    if (functionCall.name === "convert_to_sql") {
      const args = JSON.parse(functionCall.args);
      
      // Call MCP server to convert to SQL
      const sqlResult = await processNaturalLanguageToSQL(args.query, userId);
      
      // Send function response back to Gemini
      const functionResponse = {
        name: functionCall.name,
        response: {
          sqlQuery: sqlResult.sqlQuery,
          entities: sqlResult.entities || [],
          intent: sqlResult.intent || "QUERY"
        }
      };
      
      // Continue the conversation with the SQL result
      const finalResult = await chat.sendMessage({
        functionResponse
      });
      
      const finalResponse = await finalResult.response;
      
      return {
        answer: finalResponse.text(),
        sql: sqlResult.sqlQuery,
        entities: sqlResult.entities
      };
    }
  }
  
  // If no function call was made
  return {
    answer: response.text(),
    sql: null,
    entities: null
  };
}

## LangChain Integration

LangChain provides a flexible framework for building applications with LLMs. Here's how to integrate your MCP server as a custom tool:

```javascript
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { initializeAgentExecutorWithOptions } = require('langchain/agents');
const { DynamicTool } = require('langchain/tools');
const axios = require('axios');

// MCP Server configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';

// Create custom tools for MCP server
const sqlGeneratorTool = new DynamicTool({
  name: "SqlGenerator",
  description: "Converts natural language to SQL. Input should be a natural language query about database data.",
  func: async (input) => {
    try {
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_generator`, {
        userId: 'langchain-user',
        parameters: {
          query: input
        }
      });
      
      return JSON.stringify(response.data.result);
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
});

const sqlExecutorTool = new DynamicTool({
  name: "SqlExecutor",
  description: "Executes a SQL query. Input should be a valid SQL query.",
  func: async (input) => {
    try {
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_executor`, {
        userId: 'langchain-user',
        parameters: {
          sql: input
        }
      });
      
      return JSON.stringify(response.data.result);
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
});

// Initialize the agent with tools
async function createDatabaseAgent() {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: 'gpt-4-turbo',
    verbose: true
  });
  
  const tools = [sqlGeneratorTool, sqlExecutorTool];
  
  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
    verbose: true,
    maxIterations: 5,
    returnIntermediateSteps: true
  });
  
  return executor;
}

// Example usage
async function answerDatabaseQuestionWithLangChain(question) {
  const agent = await createDatabaseAgent();
  const result = await agent.call({ input: question });
  
  return result;
}

## Claude/Anthropic Integration

You can integrate Claude models from Anthropic with your MCP server using their tool use capabilities:

```javascript
const { Client } = require('@anthropic-ai/sdk');
const axios = require('axios');

// Initialize Anthropic client
const anthropic = new Client({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// MCP Server configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';

// Function to process natural language to SQL using MCP server
async function processNaturalLanguageToSQL(query, userId) {
  try {
    const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_generator`, {
      userId,
      parameters: {
        query
      }
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error calling MCP server:', error);
    throw new Error(`Failed to convert query to SQL: ${error.message}`);
  }
}

// Function to execute SQL query using MCP server
async function executeSQLQuery(sql, userId) {
  try {
    const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_executor`, {
      userId,
      parameters: {
        sql
      }
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error executing SQL query:', error);
    throw new Error(`Failed to execute SQL query: ${error.message}`);
  }
}

// Example: Using Claude with MCP server
async function answerDatabaseQuestionWithClaude(question, userId) {
  // Call Claude API with tool definitions
  const message = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1024,
    system: "You are a database assistant that can answer questions by converting them to SQL.",
    messages: [
      { role: 'user', content: question }
    ],
    tools: [
      {
        name: 'convert_to_sql',
        description: 'Converts a natural language question into a SQL query',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The natural language question to convert to SQL'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'execute_sql',
        description: 'Executes a SQL query against the database',
        input_schema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'The SQL query to execute'
            }
          },
          required: ['sql']
        }
      }
    ]
  });

  // Handle tool calls if any
  if (message.content && message.content.length > 0) {
    for (const content of message.content) {
      if (content.type === 'tool_use') {
        const toolCall = content;
        
        if (toolCall.name === 'convert_to_sql') {
          // Convert natural language to SQL
          const sqlResult = await processNaturalLanguageToSQL(toolCall.input.query, userId);
          
          // Call Claude again with the SQL result
          const secondResponse = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1024,
            system: "You are a database assistant that can answer questions by converting them to SQL.",
            messages: [
              { role: 'user', content: question },
              { 
                role: 'assistant', 
                content: [
                  { type: 'tool_use', id: toolCall.id, name: 'convert_to_sql', input: toolCall.input }
                ]
              },
              { 
                role: 'user', 
                content: [
                  { 
                    type: 'tool_result', 
                    tool_use_id: toolCall.id, 
                    content: JSON.stringify(sqlResult)
                  }
                ]
              }
            ],
            tools: [
              {
                name: 'execute_sql',
                description: 'Executes a SQL query against the database',
                input_schema: {
                  type: 'object',
                  properties: {
                    sql: {
                      type: 'string',
                      description: 'The SQL query to execute'
                    }
                  },
                  required: ['sql']
                }
              }
            ]
          });
          
          // Process the response
          if (secondResponse.content && secondResponse.content.length > 0) {
            for (const content of secondResponse.content) {
              if (content.type === 'tool_use' && content.name === 'execute_sql') {
                // Execute the SQL query
                const queryResult = await executeSQLQuery(content.input.sql, userId);
                
                // Get final interpretation from Claude
                const finalResponse = await anthropic.messages.create({
                  model: 'claude-3-sonnet-20240229',
                  max_tokens: 1024,
                  system: "You are a database assistant that can answer questions by converting them to SQL.",
                  messages: [
                    { role: 'user', content: question },
                    { 
                      role: 'assistant', 
                      content: [
                        { type: 'tool_use', id: toolCall.id, name: 'convert_to_sql', input: toolCall.input }
                      ]
                    },
                    { 
                      role: 'user', 
                      content: [
                        { 
                          type: 'tool_result', 
                          tool_use_id: toolCall.id, 
                          content: JSON.stringify(sqlResult)
                        }
                      ]
                    },
                    { 
                      role: 'assistant', 
                      content: [
                        { type: 'tool_use', id: content.id, name: 'execute_sql', input: content.input }
                      ]
                    },
                    { 
                      role: 'user', 
                      content: [
                        { 
                          type: 'tool_result', 
                          tool_use_id: content.id, 
                          content: JSON.stringify(queryResult)
                        }
                      ]
                    }
                  ]
                });
                
                // Extract final text response
                const textContent = finalResponse.content
                  .filter(c => c.type === 'text')
                  .map(c => c.text)
                  .join('\n');
                
                return {
                  answer: textContent,
                  sql: sqlResult.sqlQuery,
                  results: queryResult
                };
              }
            }
          }
        }
      }
    }
  }
  
  // If no tool was called or process didn't complete
  const textContent = message.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
  
  return {
    answer: textContent,
    sql: null,
    results: null
  };
}

## Custom LLM Integration

If you're using a custom or self-hosted LLM, you can still integrate with your MCP server through API calls:

```javascript
const axios = require('axios');

// MCP Server configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';
const LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:8000/v1/chat/completions';

// Function to query your custom LLM
async function queryChatModel(messages) {
  try {
    const response = await axios.post(LLM_API_URL, {
      model: "your-model-name",
      messages,
      temperature: 0.2,
      max_tokens: 1000
    });
    
    return response.data.choices[0].message;
  } catch (error) {
    console.error('Error querying LLM:', error);
    throw new Error(`Failed to query LLM: ${error.message}`);
  }
}

// Function to process natural language to SQL using MCP server
async function processNaturalLanguageToSQL(query, userId) {
  try {
    const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_generator`, {
      userId,
      parameters: {
        query
      }
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error calling MCP server:', error);
    throw new Error(`Failed to convert query to SQL: ${error.message}`);
  }
}

// Function to execute SQL query using MCP server
async function executeSQLQuery(sql, userId) {
  try {
    const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_executor`, {
      userId,
      parameters: {
        sql
      }
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error executing SQL query:', error);
    throw new Error(`Failed to execute SQL query: ${error.message}`);
  }
}

// Example: Using custom LLM with MCP server
async function answerDatabaseQuestionWithCustomLLM(question, userId) {
  // First, ask the LLM if this is a database question
  const initialMessage = await queryChatModel([
    { role: "system", content: "You are a helpful assistant. If the user is asking a question that requires querying a database, respond with ONLY the text 'DATABASE_QUERY'. Otherwise, answer the question directly." },
    { role: "user", content: question }
  ]);
  
  if (initialMessage.content.includes('DATABASE_QUERY')) {
    // This is a database query, use MCP server
    try {
      // Convert to SQL
      const sqlResult = await processNaturalLanguageToSQL(question, userId);
      
      // Execute the SQL
      const queryResult = await executeSQLQuery(sqlResult.sqlQuery, userId);
      
      // Ask LLM to interpret the results
      const finalResponse = await queryChatModel([
        { role: "system", content: "You are a helpful database assistant. Explain the query results in a clear, concise way." },
        { role: "user", content: `Question: ${question}\nSQL Query: ${sqlResult.sqlQuery}\nResults: ${JSON.stringify(queryResult)}` }
      ]);
      
      return {
        answer: finalResponse.content,
        sql: sqlResult.sqlQuery,
        results: queryResult
      };
    } catch (error) {
      // Handle errors
      return {
        answer: `I encountered an error while trying to query the database: ${error.message}`,
        sql: null,
        results: null
      };
    }
  } else {
    // Not a database query, return the LLM's direct answer
    return {
      answer: initialMessage.content,
      sql: null,
      results: null
    };
  }
}

## Creating AI Applications

Now that you've integrated your MCP server with various AI systems, you can create complete applications. Here's an example of a simple web application that uses your MCP server via an AI model:

```javascript
const express = require('express');
const { answerDatabaseQuestionWithGPT } = require('./openai-integration');
// Import other integration modules as needed

const app = express();
app.use(express.json());
app.use(express.static('public'));

// API endpoint for answering database questions
app.post('/api/answer', async (req, res) => {
  try {
    const { question, userId, model = 'gpt' } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    let response;
    
    // Use the appropriate integration based on user preference
    switch (model.toLowerCase()) {
      case 'gpt':
        response = await answerDatabaseQuestionWithGPT(question, userId || 'default-user');
        break;
      case 'gemini':
        response = await answerDatabaseQuestionWithGemini(question, userId || 'default-user');
        break;
      case 'claude':
        response = await answerDatabaseQuestionWithClaude(question, userId || 'default-user');
        break;
      default:
        return res.status(400).json({ error: 'Invalid model specified' });
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({ error: 'Failed to process your question', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Integration Testing

To ensure your integrations work properly, create a suite of integration tests:

```javascript
// integration-tests.js
const axios = require('axios');
const assert = require('assert');
const { 
  answerDatabaseQuestionWithGPT,
  answerDatabaseQuestionWithGemini,
  answerDatabaseQuestionWithClaude,
  answerDatabaseQuestionWithCustomLLM
} = require('./ai-integrations');

// Test configuration
const TEST_USER_ID = 'integration_test_user';
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';

// Test cases
const TEST_CASES = [
  {
    name: 'Simple SELECT query',
    question: 'Show me all users',
    expectedSQLPattern: /SELECT.*FROM.*users/i
  },
  {
    name: 'Query with condition',
    question: 'Find products that cost more than $50',
    expectedSQLPattern: /SELECT.*FROM.*products.*WHERE.*price.*>\s*50/i
  },
  {
    name: 'Query with JOIN',
    question: 'Show me all products in the Electronics category',
    expectedSQLPattern: /SELECT.*FROM.*products.*JOIN.*categories/i
  },
  {
    name: 'Aggregation query',
    question: 'What is the average price of products in each category?',
    expectedSQLPattern: /SELECT.*AVG.*GROUP BY/i
  }
];

// Helper function to verify MCP server is running
async function checkMCPServerHealth() {
  try {
    const response = await axios.get(`${MCP_SERVER_URL}/health`);
    return response.status === 200;
  } catch (error) {
    console.error('MCP server health check failed:', error.message);
    return false;
  }
}

// Test each integration
async function runIntegrationTests() {
  console.log('Running MCP Server Integration Tests');
  
  // Check if MCP server is running
  const serverIsRunning = await checkMCPServerHealth();
  if (!serverIsRunning) {
    console.error('MCP server is not running. Please start the server before running tests.');
    process.exit(1);
  }
  
  // Test OpenAI GPT integration
  console.log('\n--- Testing OpenAI GPT Integration ---');
  await testIntegration(answerDatabaseQuestionWithGPT, 'GPT');
  
  // Test Google Gemini integration
  console.log('\n--- Testing Google Gemini Integration ---');
  await testIntegration(answerDatabaseQuestionWithGemini, 'Gemini');
  
  // Test Claude integration
  console.log('\n--- Testing Claude Integration ---');
  await testIntegration(answerDatabaseQuestionWithClaude, 'Claude');
  
  // Test Custom LLM integration
  console.log('\n--- Testing Custom LLM Integration ---');
  await testIntegration(answerDatabaseQuestionWithCustomLLM, 'Custom LLM');
  
  console.log('\n✅ All integration tests completed!');
}

// Function to test a specific integration
async function testIntegration(integrationFunction, integrationName) {
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of TEST_CASES) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      const result = await integrationFunction(testCase.question, TEST_USER_ID);
      
      // Verify that SQL was generated
      if (!result.sql) {
        console.log(`❌ Failed: No SQL query was generated`);
        failedTests++;
        continue;
      }
      
      // Verify that the SQL matches the expected pattern
      if (!testCase.expectedSQLPattern.test(result.sql)) {
        console.log(`❌ Failed: SQL doesn't match expected pattern`);
        console.log(`Generated SQL: ${result.sql}`);
        console.log(`Expected pattern: ${testCase.expectedSQLPattern}`);
        failedTests++;
        continue;
      }
      
      // Additional checks can be added here
      
      console.log(`✅ Passed!`);
      passedTests++;
    } catch (error) {
      console.log(`❌ Failed with error: ${error.message}`);
      failedTests++;
    }
  }
  
  console.log(`\n${integrationName} Integration Results: ${passedTests} passed, ${failedTests} failed`);
  return { passedTests, failedTests };
}

// Run the tests
if (require.main === module) {
  runIntegrationTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}
```

## Conclusion

Your MCP server can be a powerful tool for AI systems to accurately convert natural language to SQL. By integrating with various AI models as shown in this guide, you can enhance query capabilities while maintaining control over the SQL generation process.

Key benefits of this approach:

1. **Security** - Your MCP server implements robust security measures to prevent SQL injection
2. **Accuracy** - Specialized SQL generation optimized for your database schema
3. **Context awareness** - User context management for conversational experiences
4. **Flexibility** - Works with various AI models and can be adapted to different use cases

For production deployments, consider implementing:

1. **Authentication** - Add proper authentication for all API endpoints
2. **Monitoring** - Set up logging and alerting for performance and security
3. **Caching** - Implement query result caching for frequent questions
4. **Rate limiting** - Protect your service from abuse
5. **Connection pooling** - Optimize database connections for higher throughput

With these integrations in place, you've created a sophisticated natural language to SQL solution that can be used as a foundation for data-driven AI applications. = require('openai');
const axios = require('axios');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// MCP Server configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000';

// Function to process natural language to SQL using MCP server
async function processNaturalLanguageToSQL(query, userId) {
  try {
    const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_generator`, {
      userId,
      parameters: {
        query
      }
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error calling MCP server:', error);
    throw new Error(`Failed to convert query to SQL: ${error.message}`);
  }
}

// Function to execute SQL query using MCP server
async function executeSQLQuery(sql, userId) {
  try {
    const response = await axios.post(`${MCP_SERVER_URL}/api/v1/tools/sql_executor`, {
      userId,
      parameters: {
        sql
      }
    });
    
    return response.data.result;
  } catch (error) {
    console.error('Error executing SQL query:', error);
    throw new Error(`Failed to execute SQL query: ${error.message}`);
  }
}

// Example: Using OpenAI function calling with MCP server
async function answerDatabaseQuestion(question, userId) {
  // Call OpenAI API with function definitions
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo', // or another model with function calling
    messages: [
      { role: 'system', content: 'You are a helpful assistant that can answer questions about databases by converting them to SQL.' },
      { role: 'user', content: question }
    ],
    functions: [
      {
        name: 'convert_to_sql',
        description: 'Converts a natural language question into a SQL query',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The natural language question to convert to SQL'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'execute_sql',
        description: 'Executes a SQL query against the database',
        parameters: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'The SQL query to execute'
            }
          },
          required: ['sql']
        }
      }
    ],
    function_call: 'auto'
  });

  const message = response.choices[0].message;

  // If the model wants to call a function
  if (message.function_call) {
    const functionName = message.function_call.name;
    const functionArgs = JSON.parse(message.function_call.arguments);
    
    if (functionName === 'convert_to_sql') {
      // Convert natural language to SQL
      const sqlResult = await processNaturalLanguageToSQL(functionArgs.query, userId);
      
      // Call GPT again with the SQL result
      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that can answer questions about databases by converting them to SQL.' },
          { role: 'user', content: question },
          { role: 'assistant', content: null, function_call: message.function_call },
          { role: 'function', name: 'convert_to_sql', content: JSON.stringify(sqlResult) }
        ],
        functions: [
          {
            name: 'execute_sql',
            description: 'Executes a SQL query against the database',
            parameters: {
              type: 'object',
              properties: {
                sql: {
                  type: 'string',
                  description: 'The SQL query to execute'
                }
              },
              required: ['sql']
            }
          }
        ]
      });
      
      const secondMessage = secondResponse.choices[0].message;
      
      // If the model wants to execute the SQL
      if (secondMessage.function_call && secondMessage.function_call.name === 'execute_sql') {
        const secondFunctionArgs = JSON.parse(secondMessage.function_call.arguments);
        
        // Execute the SQL query
        const queryResult = await executeSQLQuery(secondFunctionArgs.sql, userId);
        
        // Call GPT once more to interpret the results
        const finalResponse = await openai.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that can answer questions about databases by converting them to SQL.' },
            { role: 'user', content: question },
            { role: 'assistant', content: null, function_call: message.function_call },
            { role: 'function', name: 'convert_to_sql', content: JSON.stringify(sqlResult) },
            { role: 'assistant', content: null, function_call: secondMessage.function_call },
            { role: 'function', name: 'execute_sql', content: JSON.stringify(queryResult) }
          ]
        });
        
        return {
          answer: finalResponse.choices[0].message.content,
          sql: sqlResult.sqlQuery,
          results: queryResult
        };
      }
    }
  }
  
  // If no function was called
  return {
    answer: message.content,
    sql: null,
    results: null
  };
}