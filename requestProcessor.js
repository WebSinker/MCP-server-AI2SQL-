// File: requestProcessor.js
// Component to process user requests and manage tool calls for a MCP server
const { processNaturalLanguage } = require('./nlToSqlConverter');
const { executeQuery } = require('./dbConnector');

async function processRequest(messages, context, toolRegistry) {
  try {
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage.content;
    
    // Step 1: Determine if this is a direct tool call or needs LLM processing
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      // Handle direct tool calls
      const results = await Promise.all(
        lastMessage.tool_calls.map(async (toolCall) => {
          const { name, parameters } = toolCall;
          return {
            tool_call_id: toolCall.id,
            name,
            result: await toolRegistry.executeTool(name, parameters, context)
          };
        })
      );
      
      return {
        role: 'assistant',
        content: null,
        tool_call_results: results
      };
    }
    
    // Step 2: For natural language messages, determine if SQL conversion is needed
    // This is simplified - in a real MCP server, you'd route to the appropriate tool
    // based on more sophisticated intent recognition
    
    // For this example, we're assuming all user messages are SQL-related
    const nlToSqlResult = await processNaturalLanguage(userMessage, {
      lastQuery: context.lastQuery,
      lastSql: context.lastSql,
      lastResult: context.lastResult
    });
    
    // Step 3: Execute the SQL and prepare response
    const sqlResults = await executeQuery(nlToSqlResult.sqlQuery);
    
    // Step 4: Update context with this interaction
    context.lastQuery = userMessage;
    context.lastSql = nlToSqlResult.sqlQuery;
    context.lastResult = {
      rowCount: sqlResults.rowCount,
      summary: `Returned ${sqlResults.rowCount} rows`
    };
    
    // Step 5: Prepare response
    return {
      role: 'assistant',
      content: `I converted your question to SQL and executed it: \n\n${nlToSqlResult.sqlQuery}\n\nThe query returned ${sqlResults.rowCount} rows.`,
      metadata: {
        sql_query: nlToSqlResult.sqlQuery,
        entities: nlToSqlResult.entities,
        intent: nlToSqlResult.intent,
        results: sqlResults
      }
    };
  } catch (error) {
    return {
      role: 'assistant',
      content: `Error processing your request: ${error.message}`,
      metadata: {
        error: error.message
      }
    };
  }
}

module.exports = { processRequest };