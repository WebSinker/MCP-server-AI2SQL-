// File: test-mcp-server.js
const axios = require('axios');
const assert = require('assert');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test_user_' + Date.now();
const VERBOSE = true; // Set to true for detailed logs

// Helper function for logging
function log(message, data = null) {
  if (VERBOSE) {
    console.log('\n--------------------------------------------');
    console.log('🔍 ' + message);
    if (data) {
      console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    }
    console.log('--------------------------------------------\n');
  }
}

// Test Suite
async function runTests() {
  log('Starting MCP Server Test Suite');
  log(`Using test user ID: ${TEST_USER_ID}`);
  
  try {
    // Test 1: Check if server is running
    await testServerHealth();
    
    // Test 2: List available tools
    const tools = await testToolsListing();
    
    // Test 3: Test context management
    await testContextManagement();
    
    // Test 4: Test direct tool execution
    if (tools.length > 0) {
      await testDirectToolExecution(tools[0].name);
    }
    
    // Test 5: Test chat functionality
    await testChat();
    
    // Test 6: Test context retention
    await testContextRetention();
    
    // Test 7: Test multi-turn conversation
    await testMultiTurnConversation();
    
    log('✅ All tests completed successfully!');
    
  } catch (error) {
    log('❌ Test failed', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Individual Test Functions
async function testServerHealth() {
  log('Testing server health...');
  
  try {
    // Try to access the tools endpoint as a basic health check
    const response = await axios.get(`${BASE_URL}/api/v1/tools`);
    assert.strictEqual(response.status, 200, 'Server should respond with 200 OK');
    log('✅ Server is running');
    return true;
  } catch (error) {
    throw new Error(`Server health check failed: ${error.message}`);
  }
}

async function testToolsListing() {
  log('Testing tools listing...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/tools`);
    assert.strictEqual(response.status, 200, 'Tools endpoint should respond with 200 OK');
    
    const { tools } = response.data;
    assert(Array.isArray(tools), 'Tools should be an array');
    log(`Found ${tools.length} tools:`, tools);
    
    // Verify tool structure
    if (tools.length > 0) {
      assert(tools[0].name, 'Tool should have a name property');
      assert(tools[0].description, 'Tool should have a description property');
    }
    
    return tools;
  } catch (error) {
    throw new Error(`Tools listing test failed: ${error.message}`);
  }
}

async function testContextManagement() {
  log('Testing context management...');
  
  try {
    // Test creating context
    const getResponse = await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'get'
    });
    assert.strictEqual(getResponse.status, 200, 'Get context should respond with 200 OK');
    assert(getResponse.data.success, 'Get context should be successful');
    assert(getResponse.data.context, 'Context should be returned');
    log('Initial context:', getResponse.data.context);
    
    // Test updating context
    const updateData = {
      sessionEntities: {
        testEntity: 'test-value',
        testNumber: 42
      },
      memoryBlocks: [
        {
          content: 'This is a test memory block',
          metadata: { type: 'test' }
        }
      ]
    };
    
    const updateResponse = await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'update',
      data: updateData
    });
    assert.strictEqual(updateResponse.status, 200, 'Update context should respond with 200 OK');
    assert(updateResponse.data.success, 'Update context should be successful');
    log('Updated context:', updateResponse.data.context);
    
    // Verify the update was applied
    const verifyResponse = await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'get'
    });
    assert.strictEqual(verifyResponse.status, 200, 'Get context should respond with 200 OK');
    assert.strictEqual(
      verifyResponse.data.context.sessionEntities.testEntity, 
      'test-value', 
      'Context should have updated entity'
    );
    log('Context after update:', verifyResponse.data.context);
    
    // Test clearing context
    const clearResponse = await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'clear'
    });
    assert.strictEqual(clearResponse.status, 200, 'Clear context should respond with 200 OK');
    assert(clearResponse.data.success, 'Clear context should be successful');
    
    // Verify context was cleared by getting a fresh one
    const afterClearResponse = await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'get'
    });
    assert.strictEqual(afterClearResponse.status, 200, 'Get context after clear should respond with 200 OK');
    assert(
      !afterClearResponse.data.context.sessionEntities.testEntity, 
      'Cleared context should not have previous entities'
    );
    log('Context after clearing:', afterClearResponse.data.context);
    
    return true;
  } catch (error) {
    throw new Error(`Context management test failed: ${error.message}`);
  }
}

async function testDirectToolExecution(toolName = 'sql_generator') {
  log(`Testing direct tool execution (${toolName})...`);
  
  try {
    // For sql_generator tool
    let parameters = {};
    
    if (toolName === 'sql_generator') {
      parameters = {
        query: 'Show me all users who registered in the last month'
      };
    } else if (toolName === 'sql_executor') {
      parameters = {
        sql: 'SELECT * FROM users LIMIT 5'
      };
    } else if (toolName === 'workbench_export') {
      parameters = {
        sql: 'SELECT * FROM users LIMIT 5',
        scriptName: 'test_script.sql'
      };
    } else {
      // Generic parameters for unknown tool
      parameters = {
        param1: 'value1',
        param2: 'value2'
      };
    }
    
    const response = await axios.post(`${BASE_URL}/api/v1/tools/${toolName}`, {
      userId: TEST_USER_ID,
      parameters
    });
    
    assert.strictEqual(response.status, 200, 'Tool execution should respond with 200 OK');
    assert(response.data.success, 'Tool execution should be successful');
    assert(response.data.result, 'Tool execution should return a result');
    log(`Tool ${toolName} execution result:`, response.data.result);
    
    return response.data.result;
  } catch (error) {
    throw new Error(`Direct tool execution test failed: ${error.message}`);
  }
}

async function testChat() {
  log('Testing chat functionality...');
  
  try {
    const messages = [
      {
        role: 'user',
        content: 'Show me all users who made purchases in the last week'
      }
    ];
    
    const response = await axios.post(`${BASE_URL}/api/v1/chat`, {
      userId: TEST_USER_ID,
      messages
    });
    
    assert.strictEqual(response.status, 200, 'Chat should respond with 200 OK');
    assert(response.data.choices, 'Chat response should include choices');
    assert(response.data.choices.length > 0, 'Chat response should include at least one choice');
    assert(response.data.choices[0].message, 'Chat response should include a message');
    
    const responseMessage = response.data.choices[0].message;
    log('Chat response:', responseMessage);
    
    return responseMessage;
  } catch (error) {
    throw new Error(`Chat test failed: ${error.message}`);
  }
}

async function testContextRetention() {
  log('Testing context retention across requests...');
  
  try {
    // First, clear any existing context
    await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'clear'
    });
    
    // Send a first message
    const firstMessages = [
      {
        role: 'user',
        content: 'Show me users who registered last week'
      }
    ];
    
    const firstResponse = await axios.post(`${BASE_URL}/api/v1/chat`, {
      userId: TEST_USER_ID,
      messages: firstMessages
    });
    
    // Get the context after first message
    const contextAfterFirst = await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'get'
    });
    
    // Make sure message is stored in context
    assert(contextAfterFirst.data.context.messageHistory, 'Context should have message history');
    log('Context after first message:', contextAfterFirst.data.context);
    
    return true;
  } catch (error) {
    throw new Error(`Context retention test failed: ${error.message}`);
  }
}

async function testMultiTurnConversation() {
  log('Testing multi-turn conversation...');
  
  try {
    // First, clear any existing context
    await axios.post(`${BASE_URL}/api/v1/context/${TEST_USER_ID}`, {
      action: 'clear'
    });
    
    // First turn
    const firstTurn = [
      {
        role: 'user',
        content: 'Show me users who registered last week'
      }
    ];
    
    const firstResponse = await axios.post(`${BASE_URL}/api/v1/chat`, {
      userId: TEST_USER_ID,
      messages: firstTurn
    });
    
    const firstAssistantMessage = firstResponse.data.choices[0].message;
    log('First assistant response:', firstAssistantMessage);
    
    // Second turn - follow up question
    const secondTurn = [
      ...firstTurn,
      firstAssistantMessage,
      {
        role: 'user',
        content: 'How many of them made a purchase?'
      }
    ];
    
    const secondResponse = await axios.post(`${BASE_URL}/api/v1/chat`, {
      userId: TEST_USER_ID,
      messages: secondTurn
    });
    
    const secondAssistantMessage = secondResponse.data.choices[0].message;
    log('Second assistant response:', secondAssistantMessage);
    
    // Check if second response references the first query
    // This is a simple heuristic check - in a real test, you'd have more specific assertions
    const secondResponseLower = secondAssistantMessage.content.toLowerCase();
    const referencesFirst = secondResponseLower.includes('user') || 
                           secondResponseLower.includes('register') ||
                           secondResponseLower.includes('week');
    
    assert(referencesFirst, 'Second response should reference context from first query');
    
    return true;
  } catch (error) {
    throw new Error(`Multi-turn conversation test failed: ${error.message}`);
  }
}

// Run the tests
runTests()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });