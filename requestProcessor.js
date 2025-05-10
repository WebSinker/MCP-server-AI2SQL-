// File: requestProcessor.js
const { processNaturalLanguage } = require('./nlToSqlConverter');
const { executeQuery } = require('./dbConnector');
const { isSchemaQuery } = require('./securityFilter');

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
          
          // Perform security checks based on tool type
          if (name === 'sql_generator' || name === 'sql_executor') {
            // Additional security verification for direct tool calls
            const isSafe = verifyToolCallSafety(name, parameters);
            
            if (!isSafe.valid) {
              return {
                tool_call_id: toolCall.id,
                name,
                error: isSafe.reason,
                success: false
              };
            }
          }
          
          try {
            const result = await toolRegistry.executeTool(name, parameters, context);
            return {
              tool_call_id: toolCall.id,
              name,
              result,
              success: true
            };
          } catch (error) {
            return {
              tool_call_id: toolCall.id,
              name,
              error: error.message,
              success: false
            };
          }
        })
      );
      
      return {
        role: 'assistant',
        content: null,
        tool_call_results: results
      };
    }
    
    // Special handling for schema-related queries
    if (isSchemaQuery(userMessage)) {
      // Generate appropriate schema query
      const schemaQuery = generateSchemaQuery(userMessage);
      
      try {
        const schemaResults = await executeQuery(schemaQuery);
        
        return {
          role: 'assistant',
          content: `Here's the database schema information you requested:\n\n${formatSchemaResults(schemaResults)}`,
          metadata: {
            sql_query: schemaQuery,
            intent: 'SCHEMA_QUERY',
            results: schemaResults
          }
        };
      } catch (error) {
        return {
          role: 'assistant',
          content: `I couldn't retrieve the schema information: ${error.message}`,
          metadata: {
            error: error.message
          }
        };
      }
    }
    
    // Step 2: Process the natural language to SQL
    const nlToSqlResult = await processNaturalLanguage(userMessage, {
      lastQuery: context.lastQuery,
      lastSql: context.lastSql,
      lastResult: context.lastResult
    });
    
    // Check if security blocked the request
    if (nlToSqlResult.error && nlToSqlResult.intent === 'SECURITY_BLOCKED') {
      // Log security alert
      console.warn(`Security alert: ${nlToSqlResult.securityAlert?.type} - ${nlToSqlResult.error}`);
      
      // Return a user-friendly security message
      return {
        role: 'assistant',
        content: securityBlockResponseMessage(nlToSqlResult.securityAlert),
        metadata: {
          security_alert: nlToSqlResult.securityAlert
        }
      };
    }
    
    // Step 3: Execute the SQL and prepare response
    let sqlResults = null;
    try {
      if (nlToSqlResult.sqlQuery) {
        sqlResults = await executeQuery(nlToSqlResult.sqlQuery);
      } else {
        throw new Error("No SQL query was generated");
      }
    } catch (error) {
      return {
        role: 'assistant',
        content: `I couldn't execute the SQL query: ${error.message}. The generated query might have issues.`,
        metadata: {
          sql_query: nlToSqlResult.sqlQuery,
          entities: nlToSqlResult.entities,
          intent: nlToSqlResult.intent,
          error: error.message
        }
      };
    }
    
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
    console.error('Request processing error:', error);
    return {
      role: 'assistant',
      content: `Error processing your request: ${error.message}`,
      metadata: {
        error: error.message
      }
    };
  }
}

// Generate appropriate schema query based on the user's request
function generateSchemaQuery(userMessage) {
  // Convert to lowercase for easier pattern matching
  const lowerMessage = userMessage.toLowerCase();
  
  // Check for specific table requests
  const tableNameMatch = lowerMessage.match(/table[s\s]+(\w+)/i);
  const tableName = tableNameMatch ? tableNameMatch[1] : null;
  
  if (tableName) {
    // If asking about a specific table, return its structure
    return `
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE, 
        COLUMN_KEY
      FROM 
        INFORMATION_SCHEMA.COLUMNS
      WHERE 
        TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '${tableName}'
      ORDER BY 
        ORDINAL_POSITION
    `;
  } else if (lowerMessage.includes('column') || lowerMessage.includes('field')) {
    // If asking about columns/fields across tables
    return `
      SELECT 
        TABLE_NAME,
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE, 
        COLUMN_KEY
      FROM 
        INFORMATION_SCHEMA.COLUMNS
      WHERE 
        TABLE_SCHEMA = DATABASE()
      ORDER BY 
        TABLE_NAME, ORDINAL_POSITION
    `;
  } else {
    // Default: return list of tables
    return `
      SELECT 
        TABLE_NAME, 
        TABLE_ROWS,
        CREATE_TIME,
        UPDATE_TIME,
        TABLE_COMMENT
      FROM 
        INFORMATION_SCHEMA.TABLES
      WHERE 
        TABLE_SCHEMA = DATABASE()
      ORDER BY 
        TABLE_NAME
    `;
  }
}

// Format schema results in a readable way
function formatSchemaResults(results) {
  if (!results || !results.rows || results.rows.length === 0) {
    return "No schema information found.";
  }
  
  // Format based on query type
  const sampleRow = results.rows[0];
  
  if (sampleRow.TABLE_NAME && sampleRow.COLUMN_NAME) {
    // This is a column listing across tables
    let formatted = '';
    let currentTable = '';
    
    for (const row of results.rows) {
      if (row.TABLE_NAME !== currentTable) {
        currentTable = row.TABLE_NAME;
        formatted += `\n## Table: ${currentTable}\n\n`;
        formatted += `| Column | Type | Nullable | Key |\n`;
        formatted += `|--------|------|----------|-----|\n`;
      }
      
      formatted += `| ${row.COLUMN_NAME} | ${row.DATA_TYPE} | ${row.IS_NULLABLE} | ${row.COLUMN_KEY || '-'} |\n`;
    }
    
    return formatted;
  } else if (sampleRow.COLUMN_NAME) {
    // This is a specific table's columns
    let formatted = `| Column | Type | Nullable | Key |\n`;
    formatted += `|--------|------|----------|-----|\n`;
    
    for (const row of results.rows) {
      formatted += `| ${row.COLUMN_NAME} | ${row.DATA_TYPE} | ${row.IS_NULLABLE} | ${row.COLUMN_KEY || '-'} |\n`;
    }
    
    return formatted;
  } else {
    // This is a table listing
    let formatted = `| Table | Rows | Created | Updated | Description |\n`;
    formatted += `|-------|------|---------|---------|-------------|\n`;
    
    for (const row of results.rows) {
      formatted += `| ${row.TABLE_NAME} | ${row.TABLE_ROWS || '-'} | ${formatDate(row.CREATE_TIME)} | ${formatDate(row.UPDATE_TIME)} | ${row.TABLE_COMMENT || '-'} |\n`;
    }
    
    return formatted;
  }
}

// Helper to format dates
function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toISOString().split('T')[0];
}

// Function to verify safety of direct tool calls
function verifyToolCallSafety(toolName, parameters) {
  // Import security filter if not already available
  const securityFilter = require('./securityFilter');
  
  if (toolName === 'sql_generator') {
    // Check the natural language query for security issues
    if (parameters.query) {
      const validation = securityFilter.validateNaturalLanguageInput(parameters.query);
      if (!validation.isValid) {
        return {
          valid: false,
          reason: validation.reason
        };
      }
    }
  } else if (toolName === 'sql_executor') {
    // Check the SQL query directly
    if (parameters.sql) {
      const validation = securityFilter.validateSql(parameters.sql);
      if (!validation.isValid) {
        return {
          valid: false,
          reason: validation.reason
        };
      }
    }
  }
  
  return { valid: true };
}

// Function to generate user-friendly security block messages
function securityBlockResponseMessage(securityAlert) {
  if (!securityAlert) {
    return "I'm unable to process this request for security reasons.";
  }
  
  // Craft different messages based on the type and severity of the security issue
  switch (securityAlert.type) {
    case 'input_validation':
      if (securityAlert.severity === 'high') {
        return "I cannot process this request as it appears to contain potentially harmful elements. Please rephrase your question without SQL syntax or special characters.";
      } else {
        return "Your request contains patterns that might be unsafe. Please rephrase your question using simpler language, focusing on what you'd like to know rather than how to query for it.";
      }
      
    case 'sql_validation':
      return "I've generated a SQL query based on your request, but it contains operations that could be harmful to your database. I can only generate safe, read-only SQL queries.";
      
    case 'sensitive_data_access':
      return "For security reasons, I cannot generate queries that directly access sensitive information like passwords or personal data. I can help you with statistical queries about this data instead.";
      
    default:
      return "I'm unable to process this request due to security concerns. Please try rephrasing your question.";
  }
}

module.exports = { processRequest };