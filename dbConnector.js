// File: dbConnector.js
const mysql = require('mysql2/promise');

// Initialize MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME || 'your_database',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Function to execute SQL queries
async function executeQuery(sqlQuery) {
  try {
    // Execute the query
    const [rows, fields] = await pool.query(sqlQuery);
    
    // Return the query results
    return {
      rows: rows,
      rowCount: rows.length,
      fields: fields ? fields.map(f => ({
        name: f.name,
        dataType: f.type
      })) : []
    };
  } catch (error) {
    console.error('Error executing SQL query:', error);
    throw new Error(`Failed to execute SQL query: ${error.message}`);
  }
}

// Function to get database schema information
async function getDatabaseSchema() {
  try {
    // Get current database name
    const [dbResult] = await pool.query('SELECT DATABASE() as db_name');
    const dbName = dbResult[0].db_name;
    
    // Query to get table information
    const tablesQuery = `
      SELECT 
        table_name 
      FROM 
        information_schema.tables 
      WHERE 
        table_schema = ?
    `;
    
    const [tables] = await pool.query(tablesQuery, [dbName]);
    
    // Get columns for each table
    const schema = {};
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      const columnsQuery = `
        SELECT 
          column_name, 
          data_type,
          is_nullable,
          column_default
        FROM 
          information_schema.columns 
        WHERE 
          table_schema = ? AND 
          table_name = ?
      `;
      
      const [columns] = await pool.query(columnsQuery, [dbName, tableName]);
      
      schema[tableName] = columns;
    }
    
    return schema;
  } catch (error) {
    console.error('Error getting database schema:', error);
    throw new Error(`Failed to get database schema: ${error.message}`);
  }
}

module.exports = {
  executeQuery,
  getDatabaseSchema
};