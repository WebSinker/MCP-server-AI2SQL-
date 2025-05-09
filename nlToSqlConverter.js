// File: nlToSqlConverter.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

Your task is to:
1. Convert the user's natural language query into a valid SQL query
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

    // Configure generation options
    const generationConfig = {
      temperature: 0.2,
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
          parts: [{ text: "I understand. I will convert natural language queries to SQL based on the provided schema." }]
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
    
    // Validate SQL to prevent injection (basic validation)
    validateSql(parsedResult.sqlQuery);
    
    return parsedResult;
  } catch (error) {
    console.error('Error in NL to SQL conversion:', error);
    throw new Error(`Failed to convert natural language to SQL: ${error.message}`);
  }
}

// Basic SQL validation function - this should be enhanced for production
function validateSql(sql) {
  // Check for dangerous SQL commands
  const dangerousCommands = ['DROP', 'DELETE', 'TRUNCATE', 'UPDATE', 'INSERT', 'ALTER', 'GRANT', 'REVOKE'];
  
  for (const command of dangerousCommands) {
    if (sql.toUpperCase().includes(command)) {
      // For data modification, you might want to allow these but with user confirmation
      if (['UPDATE', 'INSERT', 'DELETE'].includes(command)) {
        console.warn(`SQL contains potentially destructive command: ${command}`);
      } else {
        throw new Error(`SQL contains forbidden command: ${command}`);
      }
    }
  }
  
  // Add more validation as needed
  return true;
}

module.exports = {
  processNaturalLanguage
};