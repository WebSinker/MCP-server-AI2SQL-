# Natural Language to SQL Converter

A web application that converts natural language queries into SQL statements, executes them, and allows you to save and manage the generated SQL scripts directly in MySQL Workbench.

![Natural Language to SQL Converter]

## 🌟 Features

- **Natural Language Processing**: Convert plain English questions into SQL queries
- **Context-Aware Queries**: Maintains conversation context for more accurate SQL generation
- **Direct Execution**: Execute SQL queries against your database
- **MySQL Workbench Integration**: Save, append, and manage SQL scripts for MySQL Workbench
- **Script Management**: View, select, and modify existing SQL scripts
- **User Context Management**: Retains information about previous queries to improve results

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## 🔧 Installation

### Prerequisites

- Node.js (v14 or higher)
- MySQL Server and MySQL Workbench
- Google Cloud account for Gemini API access

### Steps

1. Clone the repository:

```bash
git clone https://github.com/yourusername/natural-language-to-sql.git
cd natural-language-to-sql
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with your configuration:

```bash
# MySQL Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database
DB_PORT=3306

# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# MySQL Workbench Configuration
MYSQL_WORKBENCH_PATH=/path/to/mysql/workbench/executable
# For Windows: MYSQL_WORKBENCH_PATH=C:\\Program Files\\MySQL\\MySQL Workbench 8.0\\mysqlworkbench.exe
# For Mac: MYSQL_WORKBENCH_PATH=/Applications/MySQLWorkbench.app/Contents/MacOS/MySQLWorkbench
# For Linux: MYSQL_WORKBENCH_PATH=/usr/bin/mysql-workbench

# MySQL CLI Path (for direct execution)
MYSQL_CLI_PATH=mysql

# Directory to store SQL scripts
SCRIPTS_DIRECTORY=./sql_scripts
```

4. Start the server:

```bash
node server.js
```

5. Open `test-MCP.html` in your web browser, or serve it using a static file server:

```bash
npx serve .
```

## ⚙️ Configuration

### Database Schema

The application is configured with a default schema that includes:
- Users
- Products
- Categories
- Orders
- Order items

To customize the schema, modify the prompt in `nlToSqlConverter.js`.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL server hostname | localhost |
| `DB_USER` | MySQL username | root |
| `DB_PASSWORD` | MySQL password | your_password |
| `DB_NAME` | MySQL database name | your_database |
| `DB_PORT` | MySQL server port | 3306 |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `MYSQL_WORKBENCH_PATH` | Path to MySQL Workbench executable | - |
| `MYSQL_CLI_PATH` | Path to MySQL CLI executable | mysql |
| `SCRIPTS_DIRECTORY` | Directory to store SQL scripts | ./sql_scripts |

## 🚀 Usage

1. Enter your question in natural language (e.g., "Show me all users who made purchases in the last month")
2. Click "Convert to SQL" to generate the SQL query
3. Review the generated SQL and results
4. Click "Apply to MySQL Workbench" to save the query
5. Optionally, view existing scripts by clicking "List Existing Scripts"
6. Select an existing script or enter a new name
7. Click "Confirm" to save the SQL script

### Example Queries

- "Create a table named students with columns for ID, name, email, and enrollment date"
- "Show me all products with price greater than $50"
- "Find the total revenue from orders in the last quarter"
- "List the top 5 customers by order total"
- "Create a view that shows product sales by category"

## 🔍 How It Works

1. **Natural Language Processing**: The application uses Google's Gemini AI model to convert natural language into SQL queries.
2. **Context Management**: Previous queries and results are stored to maintain context for follow-up questions.
3. **SQL Execution**: Generated SQL is executed against your MySQL database.
4. **MySQL Workbench Integration**: Generated SQL can be saved as script files that can be opened in MySQL Workbench or executed directly via the MySQL CLI.

### SQL Script Management

- **New Scripts**: When saving a new script, the system creates a file with metadata headers.
- **Existing Scripts**: When appending to an existing script, the system preserves the original content and adds the new query with a timestamp separator.
- **Script Organization**: All scripts are stored in the configured `SCRIPTS_DIRECTORY`.

## 📁 Project Structure

```
natural-language-to-sql/
├── server.js              # Main server file
├── nlToSqlConverter.js    # Converts natural language to SQL
├── dbConnector.js         # Database connection and query execution
├── contextManager.js      # Manages user context and query history
├── mysqlWorkbenchConnector.js # MySQL Workbench integration
├── test-MCP.html          # Frontend interface
├── .env                   # Environment configuration
├── sql_scripts/           # Generated SQL scripts
└── README.md              # This file
```

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/query` | POST | Convert natural language to SQL and execute it |
| `/schema` | GET | Get database schema information |
| `/apply-to-workbench` | POST | Save SQL query to a file for MySQL Workbench |
| `/list-scripts` | GET | List existing SQL scripts |

### `/query` Endpoint

```json
{
  "text": "Show me all users who registered last month",
  "userId": "user123"
}
```

### `/apply-to-workbench` Endpoint

```json
{
  "sqlQuery": "SELECT * FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)",
  "userId": "user123",
  "scriptName": "monthly_reports.sql"
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Google Generative AI](https://cloud.google.com/vertex-ai/generative-ai) for the Gemini model
- [Express.js](https://expressjs.com/) for the server framework
- [MySQL](https://www.mysql.com/) for the database