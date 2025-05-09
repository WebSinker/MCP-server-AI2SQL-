// File: server.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { processNaturalLanguage } = require('./nlToSqlConverter');
const { executeQuery } = require('./dbConnector');
const { ContextManager } = require('./contextManager');
const { applyToMySQLWorkbench } = require('./mysqlWorkbenchConnector');

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

// Endpoint to list existing SQL scripts
app.get('/list-scripts', async (req, res) => {
  try {
    // Get script directory from environment variable or use default
    const scriptsDir = process.env.SCRIPTS_DIRECTORY || path.join(__dirname, 'sql_scripts');
    
    // Ensure the scripts directory exists
    await fs.mkdir(scriptsDir, { recursive: true });
    
    // Read the directory
    const files = await fs.readdir(scriptsDir);
    
    // Filter to only show .sql files
    const sqlFiles = files.filter(file => file.endsWith('.sql'));
    
    // Get file stats (creation time, etc.) for each file
    const fileDetails = await Promise.all(
      sqlFiles.map(async (file) => {
        const filePath = path.join(scriptsDir, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: filePath,
          created: stats.birthtime,
          modified: stats.mtime,
          size: stats.size
        };
      })
    );
    
    // Sort by modification time (newest first)
    fileDetails.sort((a, b) => b.modified - a.modified);
    
    res.json({
      success: true,
      scripts: fileDetails
    });
  } catch (error) {
    console.error('Error listing scripts:', error);
    res.status(500).json({ 
      error: 'Failed to list scripts',
      details: error.message 
    });
  }
});

// New endpoint to apply SQL to MySQL Workbench
app.post('/apply-to-workbench', async (req, res) => {
  try {
    const { sqlQuery, userId, scriptName } = req.body;
    
    if (!sqlQuery || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: sqlQuery and userId' 
      });
    }
    
    // Apply the SQL to MySQL Workbench
    const result = await applyToMySQLWorkbench(sqlQuery, scriptName);
    
    // Return the results
    res.json({
      success: true,
      message: 'SQL successfully applied to MySQL Workbench',
      details: result
    });
  } catch (error) {
    console.error('Error applying SQL to Workbench:', error);
    res.status(500).json({ 
      error: 'Failed to apply SQL to MySQL Workbench',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Model Context Protocol Server running on port ${PORT}`);
});