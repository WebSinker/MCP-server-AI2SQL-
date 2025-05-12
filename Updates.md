# Updates

## Version 1.1.0 - May 12, 2025

### Enhancements to `ContextManager.js`

1. **Redis Integration for Persistent Context Storage**
   - Replaced in-memory `Map` storage with Redis for storing user contexts.
   - Ensures persistence across server restarts and better scalability in distributed environments.

2. **Concurrency Handling with Redlock**
   - Introduced `redlock` for distributed locking to handle concurrent updates to the same user context.
   - Prevents race conditions when multiple processes or threads access the same context.

3. **Improved Error Handling**
   - Added error handling for invalid `userId` and Redis operations.
   - Ensures graceful recovery from unexpected inputs or Redis failures.

4. **Expired Context Cleanup**
   - Implemented a method to clean up expired contexts stored in Redis.
   - Prevents accumulation of stale data, maintaining optimal performance.

5. **Query History Management**
   - Limited the query history stored in each context to the last 5 queries.
   - Prevents context size from growing indefinitely, improving performance.

6. **Timestamp Updates**
   - Automatically updated the `updatedAt` timestamp whenever a context is retrieved or modified.
   - Supports expiration logic and tracks the last activity for each context.

### Impact of Changes
- **Scalability**: Redis integration allows handling larger-scale applications with distributed servers.
- **Reliability**: Distributed locking ensures data consistency.
- **Performance**: Expired context cleanup prevents Redis from being cluttered with stale data.
- **Error Resilience**: Improved error handling ensures graceful recovery from issues.

---
