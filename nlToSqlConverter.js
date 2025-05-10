// File: nlToSqlConverter.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { validateNaturalLanguageInput, validateSql, assessSensitiveDataRequest } = require('./securityFilter');
require('dotenv').config();

// Add debug logging
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
}

// Initialize Gemini API client
const genAI = new GoogleGenerativeAI(apiKey);

// Function to process natural language and convert to SQL
async function processNaturalLanguage(text, userContext = {}) {
  try {
    // STEP 1: Security check for natural language input
    const inputValidation = validateNaturalLanguageInput(text);
    
    if (!inputValidation.isValid) {
      return {
        sqlQuery: null,
        entities: [],
        intent: 'SECURITY_BLOCKED',
        error: inputValidation.reason,
        securityAlert: {
          type: 'input_validation',
          severity: inputValidation.severity,
          details: inputValidation.reason
        }
      };
    }
    
    // Add security warning to context if present
    if (inputValidation.warning) {
      console.warn(`Security warning for query: ${text} - ${inputValidation.warning}`);
    }

    // Create a prompt that includes database schema information
    const prompt = `
You are an expert SQL translator that converts natural language queries into MySQL SQL statements.
You have access to a database with the following schema:

Table: users
Columns: id (int, primary key, auto_increment), name (varchar(255)), email (varchar(255)), created_at (datetime)

Table: products
Columns: id (int, primary key, auto_increment), name (varchar(255)), price (decimal(10,2)), category_id (int, foreign key)

Table: categories
Columns: id (int, primary key, auto_increment), name (varchar(255))

Table: orders
Columns: id (int, primary key, auto_increment), user_id (int, foreign key), created_at (datetime), total (decimal(10,2))

Table: order_items
Columns: id (int, primary key, auto_increment), order_id (int, foreign key), product_id (int, foreign key), quantity (int), price (decimal(10,2))

SECURITY REQUIREMENTS:
1. ONLY generate SELECT queries - NEVER generate INSERT, UPDATE, DELETE, DROP, CREATE, ALTER or any other data modification or schema modification queries.
2. Do not use multiple SQL statements separated by semicolons.
3. Avoid any syntax that might be used for SQL injection attacks.
4. Do not reference tables or columns that don't exist in the schema.
5. For security reasons, never include literals that look like SQL injection attempts, even if they appear in the user's question.
6. Do NOT use UNION SELECT unless absolutely necessary.
7. Never generate queries that would directly retrieve sensitive data like passwords.
8. If asked for sensitive information, generate a statistical query instead.

Your task is to:
1. Convert the user's natural language query into a valid MySQL SELECT query
2. Extract entities mentioned in the query
3. Identify the user's intent

Respond with a JSON object containing:
{
  "sqlQuery": "THE SQL QUERY",
  "entities": ["entity1", "entity2", ...],
  "intent": "QUERY_INTENT"
}

Consider the conversation context if provided.
    `;

    // Include context from previous interactions if available
    let userInput = text;
    
    if (userContext.lastQuery) {
      userInput = `
Previous query: ${userContext.lastQuery}
Previous SQL: ${userContext.lastSql}
Previous result summary: ${JSON.stringify(userContext.lastResult).substring(0, 200)}...

Current query: ${text}
      `;
    }

    // Get the Gemini Pro model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Configure generation options - lower temperature for more deterministic outputs
    const generationConfig = {
      temperature: 0.1,  // Reduced from 0.2 for more predictable outputs
      topP: 0.8,
      topK: 40
    };

    // Create the chat session
    const chat = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [{ text: prompt }]
        },
        {
          role: "model",
          parts: [{ text: "I understand. I will convert natural language queries to secure SQL SELECT statements based on the provided schema." }]
        }
      ]
    });

    // Send the user query to the chat
    const result = await chat.sendMessage(userInput);
    const response = await result.response;
    const responseText = response.text();
    
    // Extract the JSON object from the response
    // Gemini may wrap the JSON in markdown code blocks, so we need to extract it
    const jsonRegex = /{[\s\S]*}/;
    const match = responseText.match(jsonRegex);
    
    let parsedResult;
    if (match) {
      try {
        parsedResult = JSON.parse(match[0]);
      } catch (e) {
        // If parsing fails, try to clean up the JSON string
        const cleanedJson = match[0].replace(/\\n/g, " ").replace(/\\"/g, '"');
        parsedResult = JSON.parse(cleanedJson);
      }
    } else {
      throw new Error("Failed to extract JSON from the model response");
    }
    
    // STEP 2: Validate the generated SQL for security issues
    if (parsedResult.sqlQuery) {
      const sqlValidation = validateSql(parsedResult.sqlQuery);
      
      if (!sqlValidation.isValid) {
        return {
          sqlQuery: null,
          entities: parsedResult.entities || [],
          intent: 'SECURITY_BLOCKED',
          error: sqlValidation.reason,
          securityAlert: {
            type: 'sql_validation',
            severity: sqlValidation.severity,
            details: sqlValidation.reason
          }
        };
      }
      
      // STEP 3: Check if the query is trying to access sensitive data
      const sensitiveDataAssessment = assessSensitiveDataRequest(text, parsedResult.sqlQuery);
      
      if (sensitiveDataAssessment.isSensitive && !sensitiveDataAssessment.isLegitimate) {
        return {
          sqlQuery: null,
          entities: parsedResult.entities || [],
          intent: 'SECURITY_BLOCKED',
          error: sensitiveDataAssessment.reason,
          securityAlert: {
            type: 'sensitive_data_access',
            severity: 'high',
            details: sensitiveDataAssessment.reason
          }
        };
      }
    }
    
    return parsedResult;
  } catch (error) {
    console.error('Error in NL to SQL conversion:', error);
    throw new Error(`Failed to convert natural language to SQL: ${error.message}`);
  }
}

module.exports = {
  processNaturalLanguage
};