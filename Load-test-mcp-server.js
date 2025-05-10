// File: load-test-mcp-server.js
const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const CONCURRENT_USERS = 10;
const REQUESTS_PER_USER = 5;
const DELAY_BETWEEN_REQUESTS_MS = 200;

// Track performance metrics
const metrics = {
  startTime: null,
  endTime: null,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: []
};

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Single user simulation
async function simulateUser(userId) {
  console.log(`Starting user simulation for ${userId}`);
  
  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    try {
      // Create a different query for each request to avoid caching effects
      const query = `Show me all users who registered ${i + 1} days ago`;
      
      const messages = [
        {
          role: 'user',
          content: query
        }
      ];
      
      // Measure response time
      const startTime = Date.now();
      
      const response = await axios.post(`${BASE_URL}/api/v1/chat`, {
        userId,
        messages
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      metrics.responseTimes.push(responseTime);
      metrics.successfulRequests++;
      
      console.log(`User ${userId} - Request ${i+1}/${REQUESTS_PER_USER} - Response time: ${responseTime}ms`);
      
      // Add a small delay between requests
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
      
    } catch (error) {
      console.error(`Error for user ${userId}, request ${i+1}:`, error.message);
      metrics.failedRequests++;
    }
    
    metrics.totalRequests++;
  }
  
  console.log(`Completed user simulation for ${userId}`);
  return true;
}

// Main load test function
async function runLoadTest() {
  console.log(`Starting load test with ${CONCURRENT_USERS} concurrent users, ${REQUESTS_PER_USER} requests each`);
  metrics.startTime = Date.now();
  
  // Create an array of promises for each user
  const userPromises = [];
  
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const userId = `load_test_user_${i}_${Date.now()}`;
    userPromises.push(simulateUser(userId));
  }
  
  // Wait for all user simulations to complete
  await Promise.all(userPromises);
  
  metrics.endTime = Date.now();
  
  // Calculate and display metrics
  const totalDuration = metrics.endTime - metrics.startTime;
  const avgResponseTime = metrics.responseTimes.reduce((sum, time) => sum + time, 0) / metrics.responseTimes.length;
  const maxResponseTime = Math.max(...metrics.responseTimes);
  const minResponseTime = Math.min(...metrics.responseTimes);
  
  // Calculate percentiles
  const sortedTimes = [...metrics.responseTimes].sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  
  console.log('\n====== LOAD TEST RESULTS ======');
  console.log(`Total duration: ${totalDuration}ms (${totalDuration/1000}s)`);
  console.log(`Total requests: ${metrics.totalRequests}`);
  console.log(`Successful requests: ${metrics.successfulRequests}`);
  console.log(`Failed requests: ${metrics.failedRequests}`);
  console.log(`Success rate: ${(metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2)}%`);
  console.log(`Requests per second: ${(metrics.totalRequests / (totalDuration / 1000)).toFixed(2)}`);
  console.log('\n====== RESPONSE TIME METRICS ======');
  console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`Minimum response time: ${minResponseTime}ms`);
  console.log(`Maximum response time: ${maxResponseTime}ms`);
  console.log(`Median response time (P50): ${p50}ms`);
  console.log(`P90 response time: ${p90}ms`);
  console.log(`P95 response time: ${p95}ms`);
  console.log(`P99 response time: ${p99}ms`);
}

// Run the load test
runLoadTest()
  .then(() => {
    console.log('Load test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });