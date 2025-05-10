// File: securityFilter.js
/**
 * Security filter module for MCP server
 * This module provides enhanced security checking for natural language inputs
 * and SQL validation to prevent injection attacks
 */

// List of potentially dangerous SQL operations
const DANGEROUS_OPERATIONS = [
  'DROP', 'DELETE', 'TRUNCATE', 'UPDATE', 'INSERT', 'ALTER', 'GRANT', 'REVOKE',
  'EXECUTE', 'EXEC', 'SYSTEM', 'INTO OUTFILE', 'INTO DUMPFILE', 'LOAD_FILE',
  'BENCHMARK', 'SLEEP', 'XP_CMDSHELL', 'SP_EXECUTE', 'INFORMATION_SCHEMA'
];

// List of SQL injection patterns - FIXED REGEX SYNTAX
const INJECTION_PATTERNS = [
  ';.*--',                  // Comment-based injection
  ';.*#',                   // MySQL comment injection
  '\'.*--',                 // String termination with comment
  '\'.*OR.*=',              // OR-based injection
  '\'.*OR.*\'.*\'.*=',      // OR with string literals
  'UNION.*SELECT',          // UNION-based injection
  'UNION.*ALL.*SELECT',     // UNION ALL-based injection
  '\\/\\*.*\\*\\/',         // Inline comment - FIXED
  '--',                     // SQL comment
  '1=1',                    // Always true condition
  '1 ?= ?1',                // Always true with spacing variants
  'DROP.*TABLE',            // Table drop attempt
  'DELETE.*FROM',           // Delete data attempt
  'INSERT.*INTO',           // Insert data attempt
  'CAST\\(.*\\)',           // Type casting - FIXED
  'CONVERT\\(.*\\)'         // Type conversion - FIXED
];

// List of sensitive keywords that might indicate malicious intent
const SENSITIVE_KEYWORDS = [
  'password', 'passwd', 'pwd', 'hash', 'salt', 'credit', 'card', 'ssn', 'social security',
  'admin', 'root', 'credentials', 'secret', 'token', 'apikey', 'api key', 'private',
  'exploit', 'hack', 'vulnerability', 'bypass'
];

/**
 * Validates a natural language input for potential malicious content
 * @param {string} input The natural language input string
 * @returns {Object} Validation result with status and reason if blocked
 */
function validateNaturalLanguageInput(input) {
  if (!input) {
    return { isValid: false, reason: 'Empty input', severity: 'low' };
  }
  
  // Convert to lowercase for case-insensitive matching
  const lowerInput = input.toLowerCase();
  
  // Check for SQL injection patterns in natural language
  for (const pattern of INJECTION_PATTERNS) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(input)) {
        return {
          isValid: false,
          reason: `Potential SQL injection detected: matches pattern "${pattern}"`,
          severity: 'high'
        };
      }
    } catch (error) {
      console.error(`Invalid regex pattern: ${pattern}`, error);
      // Continue with other patterns instead of failing
    }
  }
  
  // Check for multiple SQL statements
  if (input.includes(';') && !/[a-z]+ [a-z]+;/.test(input)) {
    return {
      isValid: false,
      reason: 'Multiple SQL statements are not allowed',
      severity: 'high'
    };
  }
  
  // Check for dangerous operations in natural language request
  for (const op of DANGEROUS_OPERATIONS) {
    // Use word boundary to match whole words
    try {
      const regex = new RegExp(`\\b${op}\\b`, 'i');
      if (regex.test(input)) {
        // Special exception for "DELETE" in legitimate contexts like "Show me users who didn't delete their account"
        if (op === 'DELETE' && (
          /didn['']t delete/.test(input) || 
          /not delete/.test(input) || 
          /never delete/.test(input)
        )) {
          continue;
        }
        
        return {
          isValid: false,
          reason: `Query contains dangerous operation: ${op}`,
          severity: 'high'
        };
      }
    } catch (error) {
      console.error(`Invalid regex for operation: ${op}`, error);
      // Continue with other operations
    }
  }
  
  // Check for sensitive keywords
  const sensitiveMatches = [];
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      sensitiveMatches.push(keyword);
    }
  }
  
  if (sensitiveMatches.length > 0) {
    // If there's only one sensitive keyword and it's used in a legitimate context, allow it
    // For example, "Show me users who updated their password recently" is okay
    const legitimatePatterns = [
      /show me .* password/i,
      /users? who .* password/i,
      /when was .* password/i,
      /list .* password/i,
      /how many .* password/i,
      /count .* password/i
    ];
    
    const potentiallyLegitimate = legitimatePatterns.some(pattern => pattern.test(input));
    
    if (sensitiveMatches.length === 1 && potentiallyLegitimate) {
      // Allow it, but add a warning
      return {
        isValid: true,
        warning: `Query contains sensitive keyword: ${sensitiveMatches[0]}, but appears to be legitimate`,
        severity: 'low'
      };
    }
    
    return {
      isValid: false,
      reason: `Query contains sensitive keywords: ${sensitiveMatches.join(', ')}`,
      severity: sensitiveMatches.length > 1 ? 'high' : 'medium'
    };
  }
  
  return { isValid: true };
}

/**
 * Validates a SQL query for potential security issues
 * @param {string} sql The SQL query to validate
 * @returns {Object} Validation result with status and reason if blocked
 */
function validateSql(sql) {
  if (!sql) {
    return { isValid: false, reason: 'Empty SQL query', severity: 'low' };
  }
  
  // Convert to uppercase for case-insensitive operation matching
  const upperSql = sql.toUpperCase();
  
  // Check for dangerous SQL commands
  for (const op of DANGEROUS_OPERATIONS) {
    // Make sure it's a standalone command (not part of a word)
    // For example, "DROP" should match but not "DROPDOWN"
    try {
      const regex = new RegExp(`\\b${op}\\b`, 'i');
      if (regex.test(upperSql)) {
        // For data modification, we might want to add a warning but not block
        if (['UPDATE', 'INSERT', 'DELETE'].includes(op)) {
          return {
            isValid: false,
            reason: `SQL contains data modification command: ${op}`,
            severity: 'medium',
            isDataModification: true
          };
        }
        
        return {
          isValid: false,
          reason: `SQL contains forbidden command: ${op}`,
          severity: 'high'
        };
      }
    } catch (error) {
      console.error(`Invalid regex for SQL operation: ${op}`, error);
      // Continue with other operations
    }
  }
  
  // Check for multiple statements
  if (sql.includes(';') && !/;\s*$/.test(sql)) {
    return {
      isValid: false,
      reason: 'Multiple SQL statements are not allowed',
      severity: 'high'
    };
  }
  
  // Check for UNION-based injection
  if (/UNION\s+(?:ALL\s+)?SELECT/i.test(sql)) {
    // Additional context check - if it's a legitimate UNION with same tables, it might be okay
    // This is a simplified check - in production you might want more sophisticated parsing
    const unionParts = sql.split(/UNION\s+(?:ALL\s+)?SELECT/i);
    if (unionParts.length > 1) {
      // Check if the fields being selected are similar on both sides of the UNION
      // This is a basic heuristic - real SQL parsing would be better
      const beforeUnionFields = extractFields(unionParts[0]);
      const afterUnionFields = extractFields(unionParts[1]);
      
      // If field count doesn't match, it's suspicious
      if (beforeUnionFields.length !== afterUnionFields.length) {
        return {
          isValid: false,
          reason: 'Suspicious UNION SELECT with different field counts',
          severity: 'high'
        };
      }
    }
  }
  
  // EXCEPTION FOR SCHEMA QUERIES
  // Allow specific schema-related queries that might otherwise be blocked
  if (/SELECT.*FROM.*INFORMATION_SCHEMA\.TABLES/i.test(sql) ||
      /SELECT.*FROM.*INFORMATION_SCHEMA\.COLUMNS/i.test(sql)) {
    // These are legitimate schema queries, but let's add a warning
    return { 
      isValid: true,
      warning: 'Query accesses database schema information',
      severity: 'low'
    };
  }
  
  return { isValid: true };
}

// Helper function to extract fields from a SELECT statement
// This is a very simplified approach - real SQL parsing would be better
function extractFields(selectStatement) {
  // Try to extract the part between SELECT and FROM
  const selectFromMatch = selectStatement.match(/SELECT\s+(.+?)\s+FROM/i);
  
  if (!selectFromMatch) return [];
  
  const fieldsStr = selectFromMatch[1];
  // Split by commas, but respect parentheses (simple approach)
  return fieldsStr.split(',').map(f => f.trim());
}

/**
 * Determine if a query is attempting to retrieve sensitive data
 * This function helps identify potentially legitimate queries that touch on sensitive topics
 * @param {string} query The natural language query
 * @param {string} sql The generated SQL
 * @returns {Object} Assessment result
 */
function assessSensitiveDataRequest(query, sql) {
  if (!query || !sql) {
    return { isSensitive: false };
  }
  
  // Check if query is asking about sensitive tables or columns
  const sensitivePatterns = [
    /password/i,
    /credit.+card/i,
    /ssn/i,
    /social security/i,
    /user.+admin/i,
    /admin.+user/i
  ];
  
  let sensitiveMatch = null;
  for (const pattern of sensitivePatterns) {
    try {
      if (pattern.test(query) || pattern.test(sql)) {
        sensitiveMatch = pattern;
        break;
      }
    } catch (error) {
      console.error(`Invalid regex pattern for sensitive data: ${pattern}`, error);
      // Continue with other patterns
    }
  }
  
  if (sensitiveMatch) {
    // Check for legitimate query patterns
    const legitimatePatterns = [
      /count|number of|how many/i,
      /when.+(changed|updated|modified)/i,
      /users?.+changed.+password/i,
      /last.+password.+change/i
    ];
    
    const isLegitimate = legitimatePatterns.some(pattern => {
      try {
        return pattern.test(query);
      } catch (error) {
        console.error(`Invalid regex pattern for legitimate check: ${pattern}`, error);
        return false;
      }
    });
    
    if (isLegitimate) {
      return {
        isSensitive: true,
        isLegitimate: true,
        warning: 'Query requests sensitive data but appears to be for legitimate statistical or audit purposes'
      };
    }
    
    return {
      isSensitive: true,
      isLegitimate: false,
      reason: 'Query appears to be requesting sensitive data directly'
    };
  }
  
  return { isSensitive: false };
}

// Special handling for schema-related queries
function isSchemaQuery(query) {
  const schemaPatterns = [
    /database schema/i,
    /table structure/i,
    /database structure/i,
    /show.+tables/i,
    /list.+tables/i,
    /describe.+table/i,
    /column.+information/i
  ];
  
  for (const pattern of schemaPatterns) {
    try {
      if (pattern.test(query)) {
        return true;
      }
    } catch (error) {
      console.error(`Invalid regex pattern for schema check: ${pattern}`, error);
    }
  }
  
  return false;
}

module.exports = {
  validateNaturalLanguageInput,
  validateSql,
  assessSensitiveDataRequest,
  isSchemaQuery,
  DANGEROUS_OPERATIONS,
  INJECTION_PATTERNS,
  SENSITIVE_KEYWORDS
};