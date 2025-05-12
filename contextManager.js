// File: contextManager.js
const Redis = require('ioredis');
const redis = new Redis();
const Redlock = require('redlock');
const redlock = new Redlock([redis]);

class ContextManager {
  constructor() {
    // Set expiration time for contexts (30 minutes in ms)
    this.expirationTime = 30 * 60 * 1000;
  }
  
  // Get a user's context, or create a new one if it doesn't exist
  async getUserContext(userId) {
    if (!userId) {
      throw new Error('Invalid userId');
    }
    try {
      let context = await redis.get(userId);
      if (!context) {
        context = {
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          sessionEntities: {},
          queryHistory: []
        };
        await redis.set(userId, JSON.stringify(context));
      } else {
        context = JSON.parse(context);
        context.updatedAt = new Date();
        await redis.set(userId, JSON.stringify(context));
      }
      return context;
    } catch (error) {
      console.error('Error retrieving user context:', error);
      throw new Error('Failed to retrieve user context');
    }
  }
  
  // Update a user's context with new information
  async updateContext(userId, newContextInfo) {
    const lock = await redlock.lock(`locks:${userId}`, 1000);
    try {
      const context = await this.getUserContext(userId);
      
      // Update context with new information
      Object.assign(context, newContextInfo);
      
      // Add query to history (limited to last 5 queries)
      if (newContextInfo.lastQuery) {
        context.queryHistory = [
          {
            query: newContextInfo.lastQuery,
            sql: newContextInfo.lastSql,
            timestamp: new Date()
          },
          ...context.queryHistory
        ].slice(0, 5);
      }
      
      // Update timestamp
      context.updatedAt = new Date();
      
      // Store the updated context
      await redis.set(userId, JSON.stringify(context));
      
      return context;
    } finally {
      await lock.unlock();
    }
  }
  
  // Clear a user's context
  async clearContext(userId) {
    await redis.del(userId);
  }
  
  // Clean up expired contexts (could be called by a timer)
  async cleanupExpiredContexts() {
    const now = new Date();
    const keys = await redis.keys('*');
    
    for (const key of keys) {
      try {
        const context = JSON.parse(await redis.get(key));
        const lastUpdated = new Date(context.updatedAt);
        const elapsed = now - lastUpdated;
        
        if (elapsed > this.expirationTime) {
          await redis.del(key);
        }
      } catch (error) {
        console.error(`Error cleaning up context for key ${key}:`, error);
      }
    }
  }
}

module.exports = {
  ContextManager
};