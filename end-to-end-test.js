// File: end-to-end-test.js
const axios = require('axios');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const MCP_BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'e2e_test_user_' + Date.now();
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Yhan91503$',
  database: process.env.DB_NAME || 'nl2sql_test',
  port: process.env.DB_PORT || 3306
};
const SCRIPTS_DIR = path.join(__dirname, 'sql_scripts');

// Make sure scripts directory exists
async function ensureScriptsDir() {
  try {
    await fs.mkdir(SCRIPTS_DIR, { recursive: true });
    console.log(`Ensured scripts directory exists: ${SCRIPTS_DIR}`);
  } catch (error) {
    console.error('Error creating scripts directory:', error);
    throw error;
  }
}

// Connect to database directly
async function connectToDatabase() {
  try {
    console.log('Connecting to database...');
    const connection = await mysql.createConnection(DB_CONFIG);
    console.log('Database connected successfully');
    return connection;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
}

// Set up test data
async function setupTestData(connection) {
  try {
    console.log('Setting up test data...');
    
    // Create test tables if they don't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category_id INT
      )
    `);
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);
    
    // Insert test categories
    await connection.execute(`
      INSERT INTO categories (name) VALUES 
      ('Electronics'), 
      ('Clothing'), 
      ('Books'), 
      ('Home & Kitchen')
    `);
    
    // Insert test products
    await connection.execute(`
      INSERT INTO products (name, price, category_id) VALUES 
      ('Smartphone', 699.99, 1),
      ('Laptop', 1299.99, 1),
      ('T-shirt', 19.99, 2),
      ('Jeans', 49.99, 2),
      ('Fiction Novel', 12.99, 3),
      ('Coffee Maker', 89.99, 4)
    `);
    
    // Insert test users
    await connection.execute(`
      INSERT INTO users (name, email, created_at) VALUES 
      ('John Doe', 'john@example.com', DATE_SUB(NOW(), INTERVAL 1 DAY)),
      ('Jane Smith', 'jane@example.com', DATE_SUB(NOW(), INTERVAL 3 DAY)),
      ('Bob Johnson', 'bob@example.com', DATE_SUB(NOW(), INTERVAL 7 DAY)),
      ('Alice Brown', 'alice@example.com', DATE_SUB(NOW(), INTERVAL 14 DAY)),
      ('Charlie Green', 'charlie@example.com', DATE_SUB(NOW(), INTERVAL 30 DAY))
    `);
    
    console.log('Test data setup complete');
  } catch (error) {
    console.error('Error setting up test data:', error);
    throw error;
  }
}

// Clean up test data
async function cleanupTestData(connection) {
  try {
    console.log('Cleaning up test data...');
    
    // Drop test tables
    await connection.execute(`DROP TABLE IF EXISTS users`);
    await connection.execute(`DROP TABLE IF EXISTS products`);
    await connection.execute(`DROP TABLE IF EXISTS categories`);
    
    console.log('Test data cleanup complete');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    throw error;
  }
}

// End-to-end test function
async function runEndToEndTest() {
  console.log('Starting end-to-end test');
  console.log(`Using test user ID: ${TEST_USER_ID}`);
  
  let connection;
  
  try {
    // Step 1: Set up environment
    await ensureScriptsDir();
    connection = await connectToDatabase();
    await setupTestData(connection);
    
    // Step 2: Generate SQL from natural language
    console.log('\nStep 2: Generate SQL from natural language');
    const nlQuery = 'Find all users who registered in the last week';
    
    const sqlGeneratorResponse = await axios.post(`${MCP_BASE_URL}/api/v1/tools/sql_generator`, {
      userId: TEST_USER_ID,
      parameters: {
        query: nlQuery
      }
    });
    
    console.log('Natural language query:', nlQuery);
    console.log('Generated SQL:', sqlGeneratorResponse.data.result.sqlQuery);
    
    // Step 3: Execute the generated SQL
    console.log('\nStep 3: Execute the generated SQL');
    const sqlQuery = sqlGeneratorResponse.data.result.sqlQuery;
    
    const sqlExecutorResponse = await axios.post(`${MCP_BASE_URL}/api/v1/tools/sql_executor`, {
      userId: TEST_USER_ID,
      parameters: {
        sql: sqlQuery
      }
    });
    
    console.log('SQL execution results:');
    console.log(`Rows returned: ${sqlExecutorResponse.data.result.rowCount}`);
    console.log('First few rows:', sqlExecutorResponse.data.result.rows.slice(0, 3));
    
    // Step 4: Export SQL to Workbench
    console.log('\nStep 4: Export SQL to MySQL Workbench');
    const scriptName = `e2e_test_${Date.now()}.sql`;
    
    const workbenchExportResponse = await axios.post(`${MCP_BASE_URL}/api/v1/tools/workbench_export`, {
      userId: TEST_USER_ID,
      parameters: {
        sql: sqlQuery,
        scriptName
      }
    });
    
    console.log('Workbench export result:', workbenchExportResponse.data.result);
    
    // Step 5: Test multi-turn conversation via chat
    console.log('\nStep 5: Test multi-turn conversation');
    
    // First turn
    const firstTurnMessages = [
      {
        role: 'user',
        content: 'Show me all products in the Electronics category'
      }
    ];
    
    const firstTurnResponse = await axios.post(`${MCP_BASE_URL}/api/v1/chat`, {
      userId: TEST_USER_ID,
      messages: firstTurnMessages
    });
    
    const firstAssistantMessage = firstTurnResponse.data.choices[0].message;
    console.log('First turn response:', firstAssistantMessage.content);
    
    // Second turn - follow up question
    const secondTurnMessages = [
      ...firstTurnMessages,
      firstAssistantMessage,
      {
        role: 'user',
        content: 'Which one is the most expensive?'
      }
    ];
    
    const secondTurnResponse = await axios.post(`${MCP_BASE_URL}/api/v1/chat`, {
      userId: TEST_USER_ID,
      messages: secondTurnMessages
    });
    
    const secondAssistantMessage = secondTurnResponse.data.choices[0].message;
    console.log('Second turn response:', secondAssistantMessage.content);
    
    // Step 6: Verify the MCP server has maintained context
    console.log('\nStep 6: Verify context management');
    const contextResponse = await axios.post(`${MCP_BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'get'
    });
    
    console.log('Context has message history:', !!contextResponse.data.context.messageHistory);
    console.log('Message history length:', 
      contextResponse.data.context.messageHistory ? contextResponse.data.context.messageHistory.length : 0);
    
    console.log('\n✅ End-to-end test completed successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ End-to-end test failed:', error.message);
    console.error(error);
    return false;
  } finally {
    // Clean up
    if (connection) {
      try {
        await cleanupTestData(connection);
        await connection.end();
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    }
  }
}

// Run the test
runEndToEndTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error running end-to-end test:', error);
    process.exit(1);
  });