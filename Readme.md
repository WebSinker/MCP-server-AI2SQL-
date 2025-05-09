# Model Context Protocol Server

A server that converts natural language to SQL queries while maintaining conversational context.

## Features

- RESTful API for processing natural language to SQL conversion
- Context management for follow-up queries
- Database schema integration for accurate SQL generation
- SQL validation for security
- Support for conversational queries

## Prerequisites

- Node.js (v16 or higher)
- MySQL database and MySQL Workbench
- Google AI Gemini API key (free tier available)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/model-context-protocol-server.git
cd model-context-protocol-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following environment variables:
```
GEMINI_API_KEY=your_gemini_api_key
DB_USER=postgres_user
DB_HOST=localhost
DB_NAME=your_database_name
DB_PASSWORD=your_database_password
DB_PORT=5432
PORT=3000
```

4. Getting a Gemini API Key:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Click on "Get API key" or "Create API key"
   - The free tier includes up to 60 queries per minute

4. Start the server:
```bash
npm start
```

## API Usage

### Convert Natural Language to SQL

**Endpoint:** `POST /query`

**Request Body:**
```json
{
  "text": "Show me all users who ordered products in the Electronics category last month",
  "userId": "user123"
}
```

**Response:**
```json
{
  "sqlQuery": "SELECT u.name, u.email FROM users u JOIN orders o ON u.id = o.user_id JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id JOIN categories c ON p.category_id = c.id WHERE c.name = 'Electronics' AND o.created_at >= date_trunc('month', current_date - interval '1 month') AND o.created_at < date_trunc('month', current_date)",
  "results": {
    "rows": [
      { "name": "John Doe", "email": "john@example.com" },
      { "name": "Jane Smith", "email": "jane@example.com" }
    ],
    "rowCount": 2,
    "fields": [
      { "name": "name", "dataType": 25 },
      { "name": "email", "dataType": 25 }
    ]
  },
  "context": {
    "userId": "user123",
    "createdAt": "2023-01-01T12:00:00.000Z",
    "updatedAt": "2023-01-01T12:05:00.000Z",
    "sessionEntities": {},
    "queryHistory": [
      {
        "query": "Show me all users who ordered products in the Electronics category last month",
        "sql": "SELECT u.name, u.email FROM users u JOIN orders o ON u.id = o.user_id JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id JOIN categories c ON p.category_id = c.id WHERE c.name = 'Electronics' AND o.created_at >= date_trunc('month', current_date - interval '1 month') AND o.created_at < date_trunc('month', current_date)",
        "timestamp": "2023-01-01T12:05:00.000Z"
      }
    ]
  }
}
```

### Get Database Schema

**Endpoint:** `GET /schema`

**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "columns": ["id", "name", "email", "created_at"]
    },
    {
      "name": "products",
      "columns": ["id", "name", "price", "category_id"]
    }
  ]
}
```

## Architecture

The server consists of the following components:

1. **Express API Server** - Handles incoming HTTP requests
2. **NL-to-SQL Converter** - Uses OpenAI's API to convert natural language to SQL
3. **Database Connector** - Executes SQL queries against a PostgreSQL database
4. **Context Manager** - Maintains conversation state for follow-up queries

## Security Considerations

- The server includes basic SQL validation to prevent SQL injection
- Implement authentication and authorization for production use
- Consider rate limiting to prevent abuse

## Extensions

- Add support for more database types (MySQL, SQLite, etc.)
- Implement a caching layer for common queries
- Add support for database migrations
- Create a web interface for testing natural language queries