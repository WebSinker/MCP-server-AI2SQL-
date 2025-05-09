// File: server.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors'); // Add this line
const { processNaturalLanguage } = require('./nlToSqlConverter');
const { executeQuery } = require('./dbConnector');
const { ContextManager } = require('./contextManager');

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS for all routes
app.use(cors()); // Add this line BEFORE other middleware

app.use(bodyParser.json());

// Initialize context manager
const contextManager = new ContextManager();

app.post('/query', async (req, res) => {
  try {
    const { text, userId } = req.body;
    
    if (!text || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: text and userId' 
      });
    }
    
    // Get user context
    const userContext = contextManager.getUserContext(userId);
    
    // Process natural language to SQL
    const { sqlQuery, entities, intent } = await processNaturalLanguage(text, userContext);
    
    // Execute the SQL query
    const results = await executeQuery(sqlQuery);
    
    // Update user context with new information
    contextManager.updateContext(userId, {
      lastQuery: text,
      lastSql: sqlQuery,
      lastEntities: entities,
      lastIntent: intent,
      lastResult: results
    });
    
    // Return the results
    res.json({
      sqlQuery, // For debugging/transparency
      results,
      context: userContext
    });
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      details: error.message 
    });
  }
});

// Get schema information endpoint (helps with context)
app.get('/schema', (req, res) => {
  // Return database schema information
  // This helps the frontend provide context to users
  res.json({
    tables: [
      {
        name: 'users',
        columns: ['id', 'name', 'email', 'created_at']
      },
      {
        name: 'products',
        columns: ['id', 'name', 'price', 'category_id']
      },
      // Add more tables as needed
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Model Context Protocol Server running on port ${PORT}`);
});