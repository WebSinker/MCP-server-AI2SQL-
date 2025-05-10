// File: enhancedContextManager.js
// for managing user contexts in a more sophisticated way to align with the need of a MCP Server.
class EnhancedContextManager {
  constructor(options = {}) {
    // In-memory store for user contexts
    this.contexts = new Map();
    
    // Configuration
    this.expirationTime = options.expirationTime || 30 * 60 * 1000; // 30 minutes default
    this.maxContextSize = options.maxContextSize || 4096; // tokens
    this.maxMessageHistory = options.maxMessageHistory || 20;
  }
  
  // Get a user's context, or create a new one if it doesn't exist
  getUserContext(userId) {
    if (!this.contexts.has(userId)) {
      this.contexts.set(userId, {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        sessionEntities: {},
        messageHistory: [],
        toolState: {},
        contextSize: 0,
        memoryBlocks: [] // For long-term memory
      });
    } else {
      // Update the timestamp to prevent expiration
      const context = this.contexts.get(userId);
      context.updatedAt = new Date();
    }
    
    return this.contexts.get(userId);
  }
  
  // Calculate token count for a message (simplified estimation)
  _estimateTokens(text) {
    // Approximate tokens as words / 0.75 (or implement a more accurate tokenizer)
    return Math.ceil(text.split(/\s+/).length / 0.75);
  }
  
  // Update a user's context with new information
  updateContext(userId, newContextInfo) {
    const context = this.getUserContext(userId);
    
    // Update basic context info
    if (newContextInfo.sessionEntities) {
      context.sessionEntities = {
        ...context.sessionEntities,
        ...newContextInfo.sessionEntities
      };
    }
    
    // Add new messages to history
    if (newContextInfo.messageHistory && newContextInfo.messageHistory.length > 0) {
      // Calculate tokens for new messages
      const newMessages = newContextInfo.messageHistory;
      
      // Add messages and update token count
      context.messageHistory = [
        ...context.messageHistory,
        ...newMessages
      ];
      
      // Trim message history if needed (sliding window approach)
      while (context.messageHistory.length > this.maxMessageHistory) {
        context.messageHistory.shift(); // Remove oldest message
      }
    }
    
    // Update tool state if provided
    if (newContextInfo.toolState) {
      context.toolState = {
        ...context.toolState,
        ...newContextInfo.toolState
      };
    }
    
    // Add memory blocks if provided
    if (newContextInfo.memoryBlocks) {
      context.memoryBlocks = [
        ...context.memoryBlocks,
        ...newContextInfo.memoryBlocks
      ];
    }
    
    // Update timestamp
    context.updatedAt = new Date();
    
    // Store the updated context
    this.contexts.set(userId, context);
    
    return context;
  }
  
  // Generate model context from user context
  generateModelContext(userId) {
    const context = this.getUserContext(userId);
    
    // Convert context to a format suitable for the model
    return {
      messages: context.messageHistory,
      entities: context.sessionEntities,
      toolState: context.toolState,
      relevantMemory: this._retrieveRelevantMemory(context)
    };
  }
  
  // Retrieve relevant memory blocks based on current context
  _retrieveRelevantMemory(context) {
    // Simplified approach - in production use embedding-based retrieval
    return context.memoryBlocks.slice(-5); // Just use 5 most recent memories
  }
  
  // Clear a user's context
  clearContext(userId) {
    this.contexts.delete(userId);
  }
  
  // Store important information as a memory block
  addMemoryBlock(userId, content, metadata = {}) {
    const context = this.getUserContext(userId);
    
    context.memoryBlocks.push({
      content,
      metadata: {
        ...metadata,
        timestamp: new Date()
      }
    });
    
    this.contexts.set(userId, context);
  }
  
  // Clean up expired contexts (called by a timer)
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

module.exports = { EnhancedContextManager };
