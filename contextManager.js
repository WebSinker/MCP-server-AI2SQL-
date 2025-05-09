// File: contextManager.js

class ContextManager {
  constructor() {
    // In-memory store for user contexts
    // In production, use a database or Redis for persistence
    this.contexts = new Map();
    
    // Set expiration time for contexts (30 minutes in ms)
    this.expirationTime = 30 * 60 * 1000;
  }
  
  // Get a user's context, or create a new one if it doesn't exist
  getUserContext(userId) {
    if (!this.contexts.has(userId)) {
      this.contexts.set(userId, {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        sessionEntities: {},
        queryHistory: []
      });
    } else {
      // Update the timestamp to prevent expiration
      const context = this.contexts.get(userId);
      context.updatedAt = new Date();
    }
    
    return this.contexts.get(userId);
  }
  
  // Update a user's context with new information
  updateContext(userId, newContextInfo) {
    const context = this.getUserContext(userId);
    
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
    this.contexts.set(userId, context);
    
    return context;
  }
  
  // Clear a user's context
  clearContext(userId) {
    this.contexts.delete(userId);
  }
  
  // Clean up expired contexts (could be called by a timer)
  cleanupExpiredContexts() {
    const now = new Date();
    
    for (const [userId, context] of this.contexts.entries()) {
      const lastUpdated = new Date(context.updatedAt);
      const elapsed = now - lastUpdated;
      
      if (elapsed > this.expirationTime) {
        this.contexts.delete(userId);
      }
    }
  }
}

module.exports = {
  ContextManager
};