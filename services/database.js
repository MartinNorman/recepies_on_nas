const config = require('../config');

// Determine which database driver to use
const useMariaDB = config.database.type === 'mariadb' || config.database.type === 'mysql';

let pool;
if (useMariaDB) {
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  const { Pool } = require('pg');
  pool = new Pool(config.database);
}

class DatabaseService {
  constructor() {
    this.pool = pool;
    this.useMariaDB = useMariaDB;
  }

  // Convert PostgreSQL $1, $2 style parameters to MySQL ? style
  convertParams(text, params) {
    if (!this.useMariaDB || !params) return { text, params };

    let convertedText = text;
    let paramIndex = 1;

    // Replace $1, $2, etc. with ?
    convertedText = convertedText.replace(/\$(\d+)/g, () => '?');

    // Replace PostgreSQL ILIKE with MySQL LIKE (case-insensitive by default in MySQL)
    convertedText = convertedText.replace(/\bILIKE\b/gi, 'LIKE');

    // Replace SERIAL PRIMARY KEY with AUTO_INCREMENT
    convertedText = convertedText.replace(/SERIAL PRIMARY KEY/gi, 'INT AUTO_INCREMENT PRIMARY KEY');

    // Replace CURRENT_TIMESTAMP for defaults
    convertedText = convertedText.replace(/DEFAULT CURRENT_TIMESTAMP/gi, 'DEFAULT CURRENT_TIMESTAMP');

    // Remove RETURNING clause (PostgreSQL specific) - we'll handle this separately
    convertedText = convertedText.replace(/\s+RETURNING\s+\*/gi, '');
    convertedText = convertedText.replace(/\s+RETURNING\s+\w+/gi, '');

    // Replace PostgreSQL ::json type cast
    convertedText = convertedText.replace(/::\s*json/gi, '');

    return { text: convertedText, params };
  }

  async query(text, params) {
    const { text: convertedText, params: convertedParams } = this.convertParams(text, params);
    const hasReturning = /\bRETURNING\b/i.test(text);

    if (this.useMariaDB) {
      try {
        const result = await this.pool.execute(convertedText, convertedParams || []);
        
        // mysql2 returns [rows, fields] for SELECT, but for INSERT/UPDATE/DELETE
        // the first element might be ResultSetHeader or the rows array
        // The actual result info is in result[0] for INSERT operations
        let rows, fields, resultInfo;
        
        if (Array.isArray(result) && result.length >= 2) {
          rows = result[0];
          fields = result[1];
          // For INSERT/UPDATE/DELETE, result[0] might be ResultSetHeader
          // For SELECT, result[0] is the rows array
          if (rows && typeof rows === 'object' && 'insertId' in rows && 'affectedRows' in rows) {
            resultInfo = rows;
            rows = [];
          }
        } else {
          rows = result[0] || [];
          fields = result[1];
        }
        
        // Check if first element is ResultSetHeader (for INSERT/UPDATE/DELETE)
        // or array (for SELECT)
        const isResultSetHeader = resultInfo || (rows && typeof rows === 'object' && 'insertId' in rows && 'affectedRows' in rows && !Array.isArray(rows));
        const resultHeader = isResultSetHeader ? (resultInfo || rows) : null;
        const dataRows = isResultSetHeader ? [] : (Array.isArray(rows) ? rows : []);
        const insertId = resultHeader && resultHeader.insertId;
        const affectedRows = (resultHeader && resultHeader.affectedRows) || dataRows.length;

        // If original query had RETURNING clause and this was an INSERT
        if (hasReturning && insertId !== undefined) {
          // For INSERT with RETURNING, fetch the inserted row
          const tableName = this.extractTableName(text);
          if (tableName && insertId) {
            const [insertedRows] = await this.pool.execute(
              `SELECT * FROM ${tableName} WHERE id = ?`,
              [insertId]
            );
            return { rows: insertedRows, fields, rowCount: insertedRows.length, insertId: insertId };
          }
          // For UPDATE/DELETE with RETURNING
          return { rows: [], fields, rowCount: affectedRows, insertId: insertId };
        }

        // For INSERT without RETURNING, we still need to capture insertId
        if (insertId !== undefined) {
          return { rows: dataRows, fields, rowCount: affectedRows, insertId: insertId };
        }

        // Return in PostgreSQL-like format for compatibility
        return { rows: dataRows, fields, rowCount: affectedRows };
      } catch (error) {
        console.error('MariaDB query error:', error.message);
        console.error('Query:', convertedText);
        console.error('Params:', convertedParams);
        throw error;
      }
    } else {
      const client = await this.pool.connect();
      try {
        const result = await client.query(text, params);
        return result;
      } finally {
        client.release();
      }
    }
  }

  // Extract table name from SQL query for RETURNING clause emulation
  extractTableName(sql) {
    // Match INSERT INTO tablename, UPDATE tablename, DELETE FROM tablename
    const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
    if (insertMatch) return insertMatch[1];

    const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (updateMatch) return updateMatch[1];

    const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
    if (deleteMatch) return deleteMatch[1];

    return null;
  }

  async getCookingTimes() {
    const query = `SELECT * FROM CookingTimes ORDER BY time ASC;`;
    const result = await this.query(query);
    return result.rows;
  }

  async getIngredients() {
    const query = `SELECT * FROM Ingredients ORDER BY ingredient ASC;`;
    const result = await this.query(query);
    return result.rows;
  }

  async getInstructions() {
    const query = `SELECT * FROM Instructions ORDER BY step ASC;`;
    const result = await this.query(query);
    return result.rows;
  }

  async getNames(page = 1, limit = 15) {
    try {
      const offset = (page - 1) * limit;
      // Try with 'Name' (singular) first, fallback to 'Names' (plural) if needed
      let query, result;
      
      try {
        query = this.useMariaDB
          ? `SELECT * FROM Name ORDER BY name ASC LIMIT ? OFFSET ?;`
          : `SELECT * FROM Name ORDER BY name ASC LIMIT $1 OFFSET $2;`;
        const params = this.useMariaDB ? [limit, offset] : [limit, offset];
        result = await this.query(query, params);
      } catch (error) {
        // If 'Name' table doesn't exist, try 'Names'
        if (error.message && (error.message.includes("doesn't exist") || error.message.includes("Unknown table"))) {
          query = this.useMariaDB
            ? `SELECT * FROM Names ORDER BY name ASC LIMIT ? OFFSET ?;`
            : `SELECT * FROM Names ORDER BY name ASC LIMIT $1 OFFSET $2;`;
          const params = this.useMariaDB ? [limit, offset] : [limit, offset];
          result = await this.query(query, params);
        } else {
          throw error;
        }
      }
      
      // Get cooking time and rating for each recipe
      const recipesWithDetails = [];
      for (const recipe of result.rows) {
        // Get cooking time
        const cookingTimeQuery = this.useMariaDB
          ? `SELECT * FROM CookingTimes WHERE id = ?`
          : `SELECT * FROM CookingTimes WHERE id = $1`;
        const cookingTimeResult = await this.query(cookingTimeQuery, [recipe.id]);
        recipe.cooking_time = cookingTimeResult.rows[0] || null;
        
        // Get rating
        const ratingQuery = this.useMariaDB
          ? `SELECT * FROM Ratings WHERE id = ?`
          : `SELECT * FROM Ratings WHERE id = $1`;
        const ratingResult = await this.query(ratingQuery, [recipe.id]);
        recipe.rating = ratingResult.rows[0] || null;
        
        recipesWithDetails.push(recipe);
      }
      
      return recipesWithDetails;
    } catch (error) {
      console.error('Error in getNames:', error);
      throw error;
    }
  }

  async getNamesCount() {
    try {
      // Try with 'Name' (singular) first, fallback to 'Names' (plural) if needed
      let query, result;
      
      try {
        query = `SELECT COUNT(*) as count FROM Name;`;
        result = await this.query(query);
      } catch (error) {
        // If 'Name' table doesn't exist, try 'Names'
        if (error.message && (error.message.includes("doesn't exist") || error.message.includes("Unknown table"))) {
          query = `SELECT COUNT(*) as count FROM Names;`;
          result = await this.query(query);
        } else {
          throw error;
        }
      }
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error in getNamesCount:', error);
      throw error;
    }
  }

  async getRatings() {
    const query = `SELECT * FROM Ratings ORDER BY id ASC;`;
    const result = await this.query(query);
    return result.rows;
  }

  async searchIngredientsByName(searchTerm) {
    const query = this.useMariaDB
      ? `SELECT * FROM Ingredients WHERE LOWER(ingredient) LIKE LOWER(?) ORDER BY ingredient ASC LIMIT 10;`
      : `SELECT * FROM Ingredients WHERE LOWER(ingredient) LIKE LOWER($1) ORDER BY ingredient ASC LIMIT 10;`;

    const result = await this.query(query, [`%${searchTerm}%`]);
    return result.rows;
  }

  async searchByIngredients(ingredientNames, matchAll = false, page = 1, limit = 50) {
    if (!ingredientNames || ingredientNames.length === 0) {
      return { results: [], pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
    }

    console.log('Database search - ingredients:', ingredientNames, 'matchAll:', matchAll, 'page:', page, 'limit:', limit);

    // Build optimized query - filter ingredients first, then join to recipes
    // This is more efficient than joining all ingredients and then filtering
    let countQuery, query, params;
    
    // Build ingredient filter conditions
    const ingredientPatterns = ingredientNames.map(ing => `%${ing}%`);
    const offset = (page - 1) * limit;
    
    if (this.useMariaDB) {
      if (matchAll) {
        // Optimized: Use INNER JOIN with GROUP BY and LIKE conditions
        // More efficient than multiple EXISTS, especially with proper indexes
        const likeConditions = ingredientPatterns.map(() => 'LOWER(TRIM(i.ingredient)) LIKE ?').join(' OR ');
        
        countQuery = `
          SELECT COUNT(DISTINCT n.id) as total
          FROM Name n
          INNER JOIN Ingredients i ON i.id = n.id
          WHERE (${likeConditions})
          GROUP BY n.id
          HAVING COUNT(DISTINCT CASE WHEN ${likeConditions.split(' OR ').map((_, idx) => `LOWER(TRIM(i.ingredient)) LIKE ?`).join(' OR ')} THEN LOWER(TRIM(i.ingredient)) END) = ?
        `;
        
        // For matchAll, we need to ensure all patterns match
        // Use a subquery approach that's more efficient
        const subqueryConditions = ingredientNames.map((_, idx) => 
          `EXISTS (SELECT 1 FROM Ingredients i${idx} WHERE i${idx}.id = n.id AND LOWER(TRIM(i${idx}.ingredient)) LIKE ?)`
        ).join(' AND ');
        
        countQuery = `
          SELECT COUNT(DISTINCT n.id) as total
          FROM Name n
          WHERE ${subqueryConditions}
        `;
        
        query = `
          SELECT n.*, ${ingredientNames.length} as matched_ingredients
          FROM Name n
          WHERE ${subqueryConditions}
          ORDER BY n.name ASC
          LIMIT ? OFFSET ?
        `;
        params = [...ingredientPatterns, limit, offset];
      } else {
        // Optimized: Use INNER JOIN with DISTINCT and OR conditions
        // Single JOIN is more efficient than multiple EXISTS
        const likeConditions = ingredientPatterns.map(() => 'LOWER(TRIM(i.ingredient)) LIKE ?').join(' OR ');
        
        countQuery = `
          SELECT COUNT(DISTINCT n.id) as total
          FROM Name n
          INNER JOIN Ingredients i ON i.id = n.id
          WHERE ${likeConditions}
        `;
        
        query = `
          SELECT DISTINCT n.*, 1 as matched_ingredients
          FROM Name n
          INNER JOIN Ingredients i ON i.id = n.id
          WHERE ${likeConditions}
          ORDER BY n.name ASC
          LIMIT ? OFFSET ?
        `;
        params = [...ingredientPatterns, limit, offset];
      }
    } else {
      if (matchAll) {
        // Optimized PostgreSQL version: Keep EXISTS for matchAll (most efficient for LIKE patterns)
        // But use a more efficient structure
        const ingredientFilters = ingredientNames.map((_, idx) => 
          `EXISTS (SELECT 1 FROM Ingredients i${idx} WHERE i${idx}.id = n.id AND LOWER(TRIM(i${idx}.ingredient)) LIKE LOWER($${idx + 1}))`
        ).join(' AND ');
        
        countQuery = `
          SELECT COUNT(DISTINCT n.id) as total
          FROM Name n
          WHERE ${ingredientFilters}
        `;
        
        query = `
          SELECT n.*, $${ingredientNames.length + 1}::int as matched_ingredients
          FROM Name n
          WHERE ${ingredientFilters}
          ORDER BY n.name ASC
          LIMIT $${ingredientNames.length + 2} OFFSET $${ingredientNames.length + 3};
        `;
        params = [...ingredientPatterns, ingredientNames.length, limit, offset];
      } else {
        // Optimized PostgreSQL version: Use INNER JOIN with OR conditions
        // Single JOIN is more efficient than multiple EXISTS for matchAny
        const likeConditions = ingredientPatterns.map((_, idx) => `LOWER(TRIM(i.ingredient)) LIKE LOWER($${idx + 1})`).join(' OR ');
        const paramCount = ingredientNames.length;
        
        countQuery = `
          SELECT COUNT(DISTINCT n.id) as total
          FROM Name n
          INNER JOIN Ingredients i ON i.id = n.id
          WHERE ${likeConditions}
        `;
        
        query = `
          SELECT DISTINCT n.*, 1 as matched_ingredients
          FROM Name n
          INNER JOIN Ingredients i ON i.id = n.id
          WHERE ${likeConditions}
          ORDER BY n.name ASC
          LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;
        params = [...ingredientPatterns, limit, offset];
      }
    }

    console.log('Executing count query:', countQuery);
    console.log('Executing query:', query);
    console.log('With params:', params);
    console.log('Searching for normalized ingredients:', ingredientNames);

    try {
      // First get total count
      const countParams = this.useMariaDB ? ingredientPatterns : ingredientPatterns;
      const countResult = await this.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total) || 0;
      const totalPages = Math.ceil(total / limit);
      
      // Add query timeout - execute with a timeout promise (reduced to 15 seconds)
      const queryPromise = this.query(query, params);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 15 seconds')), 15000)
      );
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      console.log('Query result:', result.rows.length, 'rows');
      console.log('Total results:', total, 'Total pages:', totalPages);
      
      // Debug: If no results, let's check what ingredients actually exist
      if (result.rows.length === 0 && page === 1) {
        console.log('No results found. Checking sample ingredients in database...');
        const sampleQuery = this.useMariaDB
          ? `SELECT DISTINCT ingredient FROM Ingredients LIMIT 20`
          : `SELECT DISTINCT ingredient FROM Ingredients LIMIT 20`;
        const sampleResult = await this.query(sampleQuery);
        console.log('Sample ingredients in database:', sampleResult.rows.map(r => r.ingredient));
      }

      // Optimize: Get all ingredients for all recipes in one query instead of N+1
      if (result.rows.length > 0) {
        const recipeIds = result.rows.map(r => r.id);
        
        // Get all ingredients for all recipes at once
        let allIngredientsQuery;
        if (this.useMariaDB) {
          const placeholders = recipeIds.map(() => '?').join(',');
          allIngredientsQuery = `SELECT * FROM Ingredients WHERE id IN (${placeholders}) ORDER BY id`;
        } else {
          allIngredientsQuery = `SELECT * FROM Ingredients WHERE id = ANY($1::int[]) ORDER BY id`;
        }
        const allIngredientsResult = await this.query(
          allIngredientsQuery, 
          this.useMariaDB ? recipeIds : [recipeIds]
        );
        
        // Group ingredients by recipe ID
        const ingredientsByRecipe = {};
        allIngredientsResult.rows.forEach(ing => {
          if (!ingredientsByRecipe[ing.id]) {
            ingredientsByRecipe[ing.id] = [];
          }
          ingredientsByRecipe[ing.id].push(ing);
        });
        
        // Get all cooking times at once
        let allCookingTimesQuery;
        if (this.useMariaDB) {
          const placeholders = recipeIds.map(() => '?').join(',');
          allCookingTimesQuery = `SELECT * FROM CookingTimes WHERE id IN (${placeholders})`;
        } else {
          allCookingTimesQuery = `SELECT * FROM CookingTimes WHERE id = ANY($1::int[])`;
        }
        const allCookingTimesResult = await this.query(
          allCookingTimesQuery,
          this.useMariaDB ? recipeIds : [recipeIds]
        );
        const cookingTimesByRecipe = {};
        allCookingTimesResult.rows.forEach(ct => {
          cookingTimesByRecipe[ct.id] = ct;
        });
        
        // Get all ratings at once
        let allRatingsQuery;
        if (this.useMariaDB) {
          const placeholders = recipeIds.map(() => '?').join(',');
          allRatingsQuery = `SELECT * FROM Ratings WHERE id IN (${placeholders})`;
        } else {
          allRatingsQuery = `SELECT * FROM Ratings WHERE id = ANY($1::int[])`;
        }
        const allRatingsResult = await this.query(
          allRatingsQuery,
          this.useMariaDB ? recipeIds : [recipeIds]
        );
        const ratingsByRecipe = {};
        allRatingsResult.rows.forEach(rating => {
          ratingsByRecipe[rating.id] = rating;
        });
        
        // Attach data to recipes
        const recipesWithIngredients = result.rows.map(recipe => {
          recipe.ingredients = ingredientsByRecipe[recipe.id] || [];
          recipe.cooking_time = cookingTimesByRecipe[recipe.id] || null;
          recipe.rating = ratingsByRecipe[recipe.id] || null;
          return recipe;
        });
        
        return {
          results: recipesWithIngredients,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        };
      }
      
      return {
        results: [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: false,
          hasPrev: false
        }
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getAllIngredients() {
    const query = 'SELECT * FROM ingredients ORDER BY name';
    const result = await this.query(query);
    return result.rows;
  }

  /**
   * Get the maximum recipe ID from the Name/Names table
   * This is the only table that contains recipe IDs - other tables reference these IDs
   */
  async getMaxRecipeId() {
    let maxId = 0;
    
    // Check both Name and Names tables (try both in case schema varies)
    const nameTables = ['Name', 'Names'];
    
    for (const tableName of nameTables) {
      try {
        let maxIdQuery;
        if (tableName === 'Name' && !this.useMariaDB) {
          // PostgreSQL requires quotes for "Name" (case-sensitive)
          maxIdQuery = `SELECT COALESCE(MAX(id), 0) as max_id FROM "Name"`;
        } else {
          maxIdQuery = `SELECT COALESCE(MAX(id), 0) as max_id FROM ${tableName}`;
        }
        
        const result = await this.query(maxIdQuery);
        if (result.rows && result.rows.length > 0) {
          const tableMaxId = this.useMariaDB
            ? (result.rows[0].max_id || 0)
            : parseInt(result.rows[0].max_id || 0);
          
          if (tableMaxId > maxId) {
            maxId = tableMaxId;
            console.log(`Found max recipe ID in ${tableName}: ${tableMaxId}`);
          }
        }
      } catch (error) {
        // Table might not exist, skip it
        if (error.message && (error.message.includes("doesn't exist") || error.message.includes("Unknown table"))) {
          console.log(`Table ${tableName} does not exist, skipping`);
          continue;
        }
        // Log other errors but continue
        console.log(`Error querying ${tableName} for max ID:`, error.message);
      }
    }
    
    console.log(`Maximum recipe ID from Name/Names tables: ${maxId}`);
    return maxId;
  }

  async createRecipe(recipeData) {
    const { name, type, description, ingredients, instructions, cooking_time, rating } = recipeData;
    // Description is optional and may not be in the database schema
    
    // Validate required fields
    if (!name || !name.trim()) {
      throw new Error('Recipe name is required');
    }
    
    try {
      // Start transaction by inserting into Name table first to get recipe ID
      // Note: Table name might be 'Name' (singular) or 'Names' (plural) depending on schema
      // Try Name first, as that's what the existing code uses
      let nameQuery, nameResult;
      let manualId = null; // Store manually calculated ID if AUTO_INCREMENT is not available
      
      try {
        // Try with 'Name' (singular) first - try to include description if provided
        // Don't specify ID - let AUTO_INCREMENT handle it
        if (description) {
          try {
            // Include category columns (Meat, Fish, Poultry) with default values
            nameQuery = this.useMariaDB
              ? `INSERT INTO Name (name, type, description, Meat, Fish, Poultry) VALUES (?, ?, ?, 0, 0, 0)`
              : `INSERT INTO Name (name, type, description, meat, fish, poultry) VALUES ($1, $2, $3, FALSE, FALSE, FALSE) RETURNING *`;
            nameResult = await this.query(nameQuery, [name, type || null, description]);
          } catch (descError) {
            // If description column doesn't exist, try without it
            if (descError.message && (descError.message.includes("Unknown column") || descError.message.includes("column") && descError.message.includes("does not exist"))) {
              console.log('Description column not found, trying with category columns');
              // Try with category columns
              try {
                nameQuery = this.useMariaDB
                  ? `INSERT INTO Name (name, type, Meat, Fish, Poultry) VALUES (?, ?, 0, 0, 0)`
                  : `INSERT INTO Name (name, type, meat, fish, poultry) VALUES ($1, $2, FALSE, FALSE, FALSE) RETURNING *`;
                nameResult = await this.query(nameQuery, [name, type || null]);
              } catch (catError) {
                // If category columns don't exist, try without them
                if (catError.message && (catError.message.includes("Unknown column") || catError.message.includes("column") && catError.message.includes("does not exist"))) {
                  console.log('Category columns not found, inserting with just name and type');
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Name (name, type) VALUES (?, ?)`
                    : `INSERT INTO Name (name, type) VALUES ($1, $2) RETURNING *`;
                  nameResult = await this.query(nameQuery, [name, type || null]);
                } else {
                  throw catError;
                }
              }
            } else {
              throw descError;
            }
          }
        } else {
          // Try with category columns first
          try {
            nameQuery = this.useMariaDB
              ? `INSERT INTO Name (name, type, Meat, Fish, Poultry) VALUES (?, ?, 0, 0, 0)`
              : `INSERT INTO Name (name, type, meat, fish, poultry) VALUES ($1, $2, FALSE, FALSE, FALSE) RETURNING *`;
            nameResult = await this.query(nameQuery, [name, type || null]);
          } catch (catError) {
            // If category columns don't exist, try without them
            if (catError.message && (catError.message.includes("Unknown column") || catError.message.includes("column") && catError.message.includes("does not exist"))) {
              console.log('Category columns not found, inserting with just name and type');
              nameQuery = this.useMariaDB
                ? `INSERT INTO Name (name, type) VALUES (?, ?)`
                : `INSERT INTO Name (name, type) VALUES ($1, $2) RETURNING *`;
              nameResult = await this.query(nameQuery, [name, type || null]);
            } else {
              throw catError;
            }
          }
        }
        
        // Log successful insertion
        console.log('Successfully inserted into Name table');
        console.log('Insert result:', {
          insertId: nameResult.insertId,
          rows: nameResult.rows,
          rowCount: nameResult.rowCount
        });
      } catch (error) {
        console.log('Error inserting into Name table:', error.message);
        console.log('Error details:', {
          message: error.message,
          code: error.code,
          sqlMessage: error.sqlMessage,
          sqlState: error.sqlState,
          errno: error.errno
        });
        
        // If 'Name' fails, try 'Names' (plural)
        if (error.message && (error.message.includes("doesn't exist") || error.message.includes("Unknown table"))) {
          try {
            // Try with description if provided
            if (description) {
              try {
                // Include category columns with default values
                nameQuery = this.useMariaDB
                  ? `INSERT INTO Names (name, type, description, Meat, Fish, Poultry) VALUES (?, ?, ?, 0, 0, 0)`
                  : `INSERT INTO Names (name, type, description, meat, fish, poultry) VALUES ($1, $2, $3, FALSE, FALSE, FALSE) RETURNING *`;
                nameResult = await this.query(nameQuery, [name, type || null, description]);
              } catch (descError) {
                // If description or category columns don't exist, try without them
                if (descError.message && (descError.message.includes("Unknown column") || descError.message.includes("column") && descError.message.includes("does not exist"))) {
                  console.log('Description or category columns not found in Names table, trying without them');
                  // Try with category columns but without description
                  try {
                    nameQuery = this.useMariaDB
                      ? `INSERT INTO Names (name, type, Meat, Fish, Poultry) VALUES (?, ?, 0, 0, 0)`
                      : `INSERT INTO Names (name, type, meat, fish, poultry) VALUES ($1, $2, FALSE, FALSE, FALSE) RETURNING *`;
                    nameResult = await this.query(nameQuery, [name, type || null]);
                  } catch (catError) {
                    // If category columns don't exist either, try with just name and type
                    if (catError.message && (catError.message.includes("Unknown column") || catError.message.includes("column") && catError.message.includes("does not exist"))) {
                      console.log('Category columns not found in Names table, inserting with just name and type');
                      nameQuery = this.useMariaDB
                        ? `INSERT INTO Names (name, type) VALUES (?, ?)`
                        : `INSERT INTO Names (name, type) VALUES ($1, $2) RETURNING *`;
                      nameResult = await this.query(nameQuery, [name, type || null]);
                    } else {
                      throw catError;
                    }
                  }
                } else if (descError.message && (descError.message.includes("doesn't have a default value") || descError.message.includes("Field 'id' doesn't have a default value"))) {
                  // Handle AUTO_INCREMENT issue for Names table - get max recipe ID from Name/Names tables
                  const maxRecipeId = await this.getMaxRecipeId();
                  manualId = maxRecipeId + 1;
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Names (id, name, type) VALUES (?, ?, ?)`
                    : `INSERT INTO Names (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
                  nameResult = await this.query(nameQuery, [manualId, name, type || null]);
                } else {
                  throw descError;
                }
              }
            } else {
              // Try with category columns first
              try {
                nameQuery = this.useMariaDB
                  ? `INSERT INTO Names (name, type, Meat, Fish, Poultry) VALUES (?, ?, 0, 0, 0)`
                  : `INSERT INTO Names (name, type, meat, fish, poultry) VALUES ($1, $2, FALSE, FALSE, FALSE) RETURNING *`;
                nameResult = await this.query(nameQuery, [name, type || null]);
              } catch (catError) {
                // If category columns don't exist, try without them
                if (catError.message && (catError.message.includes("Unknown column") || catError.message.includes("column") && catError.message.includes("does not exist"))) {
                  console.log('Category columns not found in Names table, inserting with just name and type');
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Names (name, type) VALUES (?, ?)`
                    : `INSERT INTO Names (name, type) VALUES ($1, $2) RETURNING *`;
                  nameResult = await this.query(nameQuery, [name, type || null]);
                } else {
                  throw catError;
                }
              }
            }
          } catch (namesError) {
            // If Names table also has AUTO_INCREMENT issue, handle it - get max recipe ID from Name/Names tables
            if (namesError.message && (namesError.message.includes("doesn't have a default value") || namesError.message.includes("Field 'id' doesn't have a default value"))) {
              const maxRecipeId = await this.getMaxRecipeId();
              manualId = maxRecipeId + 1;
              
              if (description) {
                try {
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Names (id, name, type, description) VALUES (?, ?, ?, ?)`
                    : `INSERT INTO Names (id, name, type, description) VALUES ($1, $2, $3, $4) RETURNING *`;
                  nameResult = await this.query(nameQuery, [manualId, name, type || null, description]);
                } catch (descError2) {
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Names (id, name, type) VALUES (?, ?, ?)`
                    : `INSERT INTO Names (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
                  nameResult = await this.query(nameQuery, [manualId, name, type || null]);
                }
              } else {
                nameQuery = this.useMariaDB
                  ? `INSERT INTO Names (id, name, type) VALUES (?, ?, ?)`
                  : `INSERT INTO Names (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
                nameResult = await this.query(nameQuery, [manualId, name, type || null]);
              }
            } else {
              throw namesError;
            }
          }
        } else if (error.message && (error.message.includes("Field 'id' doesn't have a default value") || (error.message.includes("doesn't have a default value") && error.message.includes("Field 'id'")))) {
          // Only treat as AUTO_INCREMENT issue if it's specifically about the 'id' field
          // Other fields like 'Meat', 'Fish', 'Poultry' should be handled separately
          console.log('AUTO_INCREMENT not set on id field, getting next ID manually');
          console.log('Original error:', error.message);
          console.log('Error code:', error.code);
          console.log('SQL state:', error.sqlState);
          
          try {
            // Get the maximum recipe ID from Name/Names table only
            // Other tables (Ingredients, Instructions, etc.) use this ID as a foreign key
            const maxRecipeId = await this.getMaxRecipeId();
            manualId = maxRecipeId + 1;
            
            // Verify the ID doesn't already exist (in case of gaps or concurrent inserts)
            let idExists = true;
            let attempts = 0;
            const maxAttempts = 100; // Safety limit
            
            while (idExists && attempts < maxAttempts) {
              const checkQuery = this.useMariaDB
                ? `SELECT id FROM Name WHERE id = ? UNION SELECT id FROM Names WHERE id = ?`
                : `SELECT id FROM "Name" WHERE id = $1 UNION SELECT id FROM Names WHERE id = $1`;
              
              const checkResult = await this.query(
                checkQuery, 
                this.useMariaDB ? [manualId, manualId] : [manualId]
              );
              
              if (checkResult.rows.length === 0) {
                idExists = false;
                console.log(`Verified ID ${manualId} is available`);
              } else {
                console.log(`ID ${manualId} already exists, trying ${manualId + 1}`);
                manualId++;
                attempts++;
              }
            }
            
            if (idExists) {
              throw new Error(`Could not find an available recipe ID after ${maxAttempts} attempts`);
            }
            
            console.log('Calculated manual recipe ID (max from Name/Names + 1, verified available):', manualId);
            
            // Insert with explicit ID - try Name first, then Names
            let insertSuccess = false;
            for (const tableName of ['Name', 'Names']) {
              try {
                if (description) {
                  try {
                    nameQuery = this.useMariaDB
                      ? `INSERT INTO ${tableName} (id, name, type, description) VALUES (?, ?, ?, ?)`
                      : `INSERT INTO ${tableName === 'Name' ? '"Name"' : 'Names'} (id, name, type, description) VALUES ($1, $2, $3, $4) RETURNING *`;
                    console.log(`Attempting to INSERT recipe with ID ${manualId}, name: "${name}"`);
                    nameResult = await this.query(nameQuery, [manualId, name, type || null, description]);
                    console.log(`Successfully INSERTED recipe with ID ${manualId}`);
                    insertSuccess = true;
                    break;
                  } catch (descError) {
                    // If description column doesn't exist, try without it
                    if (descError.message && (descError.message.includes("Unknown column") || descError.message.includes("column") && descError.message.includes("does not exist"))) {
                      nameQuery = this.useMariaDB
                        ? `INSERT INTO ${tableName} (id, name, type) VALUES (?, ?, ?)`
                        : `INSERT INTO ${tableName === 'Name' ? '"Name"' : 'Names'} (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
                      console.log(`Attempting to INSERT recipe with ID ${manualId}, name: "${name}" (no description)`);
                      nameResult = await this.query(nameQuery, [manualId, name, type || null]);
                      console.log(`Successfully INSERTED recipe with ID ${manualId}`);
                      insertSuccess = true;
                      break;
                    } else {
                      throw descError;
                    }
                  }
                } else {
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO ${tableName} (id, name, type) VALUES (?, ?, ?)`
                    : `INSERT INTO ${tableName === 'Name' ? '"Name"' : 'Names'} (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
                  console.log(`Attempting to INSERT recipe with ID ${manualId}, name: "${name}" (no description, no category)`);
                  nameResult = await this.query(nameQuery, [manualId, name, type || null]);
                  console.log(`Successfully INSERTED recipe with ID ${manualId}`);
                  insertSuccess = true;
                  break;
                }
              } catch (tableError) {
                // If this table doesn't exist or fails, try the next one
                if (tableError.message && (tableError.message.includes("doesn't exist") || tableError.message.includes("Unknown table"))) {
                  continue;
                }
                // If it's a different error, log it but continue to next table
                console.log(`Error inserting into ${tableName}:`, tableError.message);
                continue;
              }
            }
            
            if (!insertSuccess) {
              // If manual ID insertion failed, the original error might not be about AUTO_INCREMENT
              // Re-throw the original error with more context
              console.error('Manual ID insertion failed. Original error was:', error.message);
              throw new Error(`Failed to insert recipe. Original error: ${error.message}. If AUTO_INCREMENT is set correctly, this might be a different issue. Check server logs for details.`);
            }
          } catch (manualIdError) {
            console.error('Error inserting with manual ID:', manualIdError);
            console.error('Error details:', {
              message: manualIdError.message,
              code: manualIdError.code,
              sqlMessage: manualIdError.sqlMessage,
              sqlState: manualIdError.sqlState,
              stack: manualIdError.stack,
              name: manualIdError.name
            });
            
            // Provide more helpful error message
            let errorMsg = `Database error: Unable to insert recipe. `;
            if (manualIdError.message && (manualIdError.message.includes("Duplicate entry") || manualIdError.code === 'ER_DUP_ENTRY')) {
              errorMsg += `The ID ${manualId} already exists. This suggests AUTO_INCREMENT might be working but the manual ID calculation is wrong. `;
            } else if (manualIdError.message && manualIdError.message.includes("doesn't have a default value")) {
              errorMsg += `The id field doesn't have AUTO_INCREMENT set. `;
            } else {
              errorMsg += `Error: ${manualIdError.message}. `;
            }
            errorMsg += `Please check your database table structure. Original error: ${error.message}`;
            throw new Error(errorMsg);
          }
        } else {
          // If it's not an AUTO_INCREMENT error, just throw the original error
          console.error('Insert failed with error:', error.message);
          console.error('Error code:', error.code);
          console.error('SQL message:', error.sqlMessage);
          throw error;
        }
      }
      
      // Get recipe ID - handle both MariaDB and PostgreSQL
      let recipeId;
      if (manualId) {
        // If we manually calculated the ID, use it
        recipeId = manualId;
        console.log('Using manually calculated ID:', recipeId);
      } else if (this.useMariaDB) {
        recipeId = nameResult.insertId;
        console.log('MariaDB insertId:', recipeId, 'Result object keys:', Object.keys(nameResult));
        if (!recipeId && nameResult.rows && nameResult.rows.length > 0) {
          recipeId = nameResult.rows[0].id;
          console.log('Got ID from rows[0]:', recipeId);
        }
        // If still no ID, try to get it from the result object directly
        if (!recipeId && nameResult.insertId === 0 && nameResult.rows && nameResult.rows.length > 0) {
          recipeId = nameResult.rows[0].id;
          console.log('Got ID from rows after checking insertId === 0:', recipeId);
        }
      } else {
        recipeId = nameResult.rows[0].id;
        console.log('PostgreSQL ID from rows[0]:', recipeId);
      }
      
      console.log('Final recipeId:', recipeId);
      
      if (!recipeId || recipeId === 0) {
        console.error('Failed to get recipe ID. Result object:', JSON.stringify(nameResult, null, 2));
        console.error('nameResult keys:', Object.keys(nameResult));
        console.error('nameResult.insertId:', nameResult.insertId);
        console.error('nameResult.rows:', nameResult.rows);
        
        // Try to verify the insert actually happened by querying for the recipe by name
        const verifyQuery = this.useMariaDB
          ? `SELECT * FROM Name WHERE name = ? ORDER BY id DESC LIMIT 1`
          : `SELECT * FROM Name WHERE name = $1 ORDER BY id DESC LIMIT 1`;
        const verifyResult = await this.query(verifyQuery, [name]);
        
        if (verifyResult.rows.length > 0) {
          recipeId = verifyResult.rows[0].id;
          console.log('Found recipe by name verification, using ID:', recipeId);
        } else {
          throw new Error('Failed to get recipe ID after insertion and recipe not found by name. The INSERT may have failed. Check server logs for details.');
        }
      }
      
      // Verify the recipe exists before inserting related data
      const verifyRecipeQuery = this.useMariaDB
        ? `SELECT id FROM Name WHERE id = ?`
        : `SELECT id FROM Name WHERE id = $1`;
      const verifyRecipeResult = await this.query(verifyRecipeQuery, [recipeId]);
      
      if (verifyRecipeResult.rows.length === 0) {
        console.error('Recipe with ID', recipeId, 'not found in database after insertion!');
        throw new Error(`Recipe was inserted but cannot be found with ID ${recipeId}. This suggests the INSERT failed or the ID is incorrect.`);
      }
      
      console.log('Recipe verified in database with ID:', recipeId);
      
      // Note: The schema uses 'id' in Name table as the recipe identifier
      // Other tables use 'id' field to reference the recipe (not 'recipe_id')
      // We'll use the Name.id as the recipe identifier

      // Insert ingredients - using id instead of recipe_id
      // WARNING: This assumes id is NOT the primary key, or that the schema allows
      // multiple rows with the same id value. If id IS the primary key, this will fail.
      if (ingredients && ingredients.length > 0) {
        for (const ingredient of ingredients) {
          const ingredientQuery = this.useMariaDB
            ? `INSERT INTO Ingredients (id, amount, amount_type, ingredient) VALUES (?, ?, ?, ?)`
            : `INSERT INTO Ingredients (id, amount, amount_type, ingredient) VALUES ($1, $2, $3, $4)`;
          await this.query(ingredientQuery, [
            recipeId,
            ingredient.amount || null,
            ingredient.amount_type || null,
            ingredient.ingredient
          ]);
        }
      }

      // Insert instructions - using id instead of recipe_id
      if (instructions && instructions.length > 0) {
        for (const instruction of instructions) {
          const instructionQuery = this.useMariaDB
            ? `INSERT INTO Instructions (id, step, instruction) VALUES (?, ?, ?)`
            : `INSERT INTO Instructions (id, step, instruction) VALUES ($1, $2, $3)`;
          await this.query(instructionQuery, [
            recipeId,
            instruction.step,
            instruction.instruction
          ]);
        }
      }

      // Insert cooking time - using id instead of recipe_id
      if (cooking_time && cooking_time.time && cooking_time.timeunit) {
        const cookingTimeQuery = this.useMariaDB
          ? `INSERT INTO CookingTimes (id, time, timeunit) VALUES (?, ?, ?)`
          : `INSERT INTO CookingTimes (id, time, timeunit) VALUES ($1, $2, $3)`;
        await this.query(cookingTimeQuery, [
          recipeId,
          cooking_time.time,
          cooking_time.timeunit
        ]);
      }

      // Insert rating - using id instead of recipe_id
      if (rating && rating.rating !== undefined) {
        const ratingQuery = this.useMariaDB
          ? `INSERT INTO Ratings (id, rating) VALUES (?, ?)`
          : `INSERT INTO Ratings (id, rating) VALUES ($1, $2)`;
        await this.query(ratingQuery, [recipeId, rating.rating]);
      }

      // Verify the recipe was actually inserted before returning
      console.log('Verifying recipe was inserted with ID:', recipeId);
      const createdRecipe = await this.getRecipeById(recipeId);
      
      if (!createdRecipe) {
        console.error('Recipe was not found after insertion! RecipeId:', recipeId);
        console.error('This suggests the INSERT may have failed or the recipeId is incorrect');
        
        // Try to find the recipe by name as a fallback
        const findByNameQuery = this.useMariaDB
          ? `SELECT * FROM Name WHERE name = ? ORDER BY id DESC LIMIT 1`
          : `SELECT * FROM Name WHERE name = $1 ORDER BY id DESC LIMIT 1`;
        const findResult = await this.query(findByNameQuery, [name]);
        
        if (findResult.rows.length > 0) {
          console.log('Found recipe by name, actual ID is:', findResult.rows[0].id);
          throw new Error(`Recipe was inserted but ID mismatch. Expected: ${recipeId}, Found: ${findResult.rows[0].id}. This suggests an issue with ID retrieval.`);
        } else {
          throw new Error(`Recipe was not found in database after insertion. RecipeId: ${recipeId}. The INSERT may have failed silently.`);
        }
      }
      
      console.log('Recipe successfully created and verified. ID:', createdRecipe.id);
      return createdRecipe;
    } catch (error) {
      console.error('Error creating recipe:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  async updateRecipe(recipeId, recipeData) {
    const { name, type, ingredients, instructions, cooking_time, rating } = recipeData;
    // Description is optional and may not be in the database schema
    
    try {
      // Update Name table
      const nameQuery = this.useMariaDB
        ? `UPDATE Name SET name = ?, type = ? WHERE id = ?`
        : `UPDATE Name SET name = $1, type = $2 WHERE id = $3`;
      await this.query(nameQuery, [name, type || null, recipeId]);

      // Delete existing related data
      const deleteQueries = [
        { table: 'Ingredients', param: recipeId },
        { table: 'Instructions', param: recipeId },
        { table: 'CookingTimes', param: recipeId },
        { table: 'Ratings', param: recipeId }
      ];

      for (const { table, param } of deleteQueries) {
        const deleteQuery = this.useMariaDB
          ? `DELETE FROM ${table} WHERE id = ?`
          : `DELETE FROM ${table} WHERE id = $1`;
        await this.query(deleteQuery, [param]);
      }

      // Re-insert ingredients - using id instead of recipe_id
      if (ingredients && ingredients.length > 0) {
        for (const ingredient of ingredients) {
          const ingredientQuery = this.useMariaDB
            ? `INSERT INTO Ingredients (id, amount, amount_type, ingredient) VALUES (?, ?, ?, ?)`
            : `INSERT INTO Ingredients (id, amount, amount_type, ingredient) VALUES ($1, $2, $3, $4)`;
          await this.query(ingredientQuery, [
            recipeId,
            ingredient.amount || null,
            ingredient.amount_type || null,
            ingredient.ingredient
          ]);
        }
      }

      // Re-insert instructions - using id instead of recipe_id
      if (instructions && instructions.length > 0) {
        for (const instruction of instructions) {
          const instructionQuery = this.useMariaDB
            ? `INSERT INTO Instructions (id, step, instruction) VALUES (?, ?, ?)`
            : `INSERT INTO Instructions (id, step, instruction) VALUES ($1, $2, $3)`;
          await this.query(instructionQuery, [
            recipeId,
            instruction.step,
            instruction.instruction
          ]);
        }
      }

      // Re-insert cooking time - using id instead of recipe_id
      if (cooking_time && cooking_time.time && cooking_time.timeunit) {
        const cookingTimeQuery = this.useMariaDB
          ? `INSERT INTO CookingTimes (id, time, timeunit) VALUES (?, ?, ?)`
          : `INSERT INTO CookingTimes (id, time, timeunit) VALUES ($1, $2, $3)`;
        await this.query(cookingTimeQuery, [
          recipeId,
          cooking_time.time,
          cooking_time.timeunit
        ]);
      }

      // Re-insert rating - using id instead of recipe_id
      if (rating && rating.rating !== undefined) {
        const ratingQuery = this.useMariaDB
          ? `INSERT INTO Ratings (id, rating) VALUES (?, ?)`
          : `INSERT INTO Ratings (id, rating) VALUES ($1, $2)`;
        await this.query(ratingQuery, [recipeId, rating.rating]);
      }

      // Return the updated recipe
      return await this.getRecipeById(recipeId);
    } catch (error) {
      console.error('Error updating recipe:', error);
      throw error;
    }
  }

  async getRecipeById(recipeId) {
    try {
      // Try with 'Name' (singular) first, fallback to 'Names' (plural) if needed
      let nameQuery, nameResult;
      
      try {
        nameQuery = this.useMariaDB
          ? `SELECT * FROM Name WHERE id = ?`
          : `SELECT * FROM Name WHERE id = $1`;
        nameResult = await this.query(nameQuery, [recipeId]);
      } catch (error) {
        // If 'Name' table doesn't exist, try 'Names'
        if (error.message && (error.message.includes("doesn't exist") || error.message.includes("Unknown table"))) {
          nameQuery = this.useMariaDB
            ? `SELECT * FROM Names WHERE id = ?`
            : `SELECT * FROM Names WHERE id = $1`;
          nameResult = await this.query(nameQuery, [recipeId]);
        } else {
          throw error;
        }
      }
      
      if (nameResult.rows.length === 0) {
        return null;
      }
      
      const recipe = nameResult.rows[0];
      
      // Get ingredients - using id instead of recipe_id
      const ingredientsQuery = this.useMariaDB
        ? `SELECT * FROM Ingredients WHERE id = ? ORDER BY id`
        : `SELECT * FROM Ingredients WHERE id = $1 ORDER BY id`;
      const ingredientsResult = await this.query(ingredientsQuery, [recipeId]);
      recipe.ingredients = ingredientsResult.rows;
      
      // Get instructions - using id instead of recipe_id
      const instructionsQuery = this.useMariaDB
        ? `SELECT * FROM Instructions WHERE id = ? ORDER BY step`
        : `SELECT * FROM Instructions WHERE id = $1 ORDER BY step`;
      const instructionsResult = await this.query(instructionsQuery, [recipeId]);
      recipe.instructions = instructionsResult.rows;
      
      // Get cooking time - using id instead of recipe_id
      const cookingTimeQuery = this.useMariaDB
        ? `SELECT * FROM CookingTimes WHERE id = ?`
        : `SELECT * FROM CookingTimes WHERE id = $1`;
      const cookingTimeResult = await this.query(cookingTimeQuery, [recipeId]);
      recipe.cooking_time = cookingTimeResult.rows[0] || null;
      
      // Get rating - using id instead of recipe_id
      const ratingQuery = this.useMariaDB
        ? `SELECT * FROM Ratings WHERE id = ?`
        : `SELECT * FROM Ratings WHERE id = $1`;
      const ratingResult = await this.query(ratingQuery, [recipeId]);
      recipe.rating = ratingResult.rows[0] || null;
      
      return recipe;
    } catch (error) {
      console.error('Error in getRecipeById:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        sqlMessage: error.sqlMessage,
        sql: error.sql,
        recipeId: recipeId
      });
      throw error;
    }
  }

  async deleteRecipe(recipeId) {
    try {
      // Delete related data first (in case of foreign key constraints)
      const deleteQueries = [
        { table: 'Ingredients', param: recipeId },
        { table: 'Instructions', param: recipeId },
        { table: 'CookingTimes', param: recipeId },
        { table: 'Ratings', param: recipeId }
      ];

      for (const { table, param } of deleteQueries) {
        const deleteQuery = this.useMariaDB
          ? `DELETE FROM ${table} WHERE id = ?`
          : `DELETE FROM ${table} WHERE id = $1`;
        await this.query(deleteQuery, [param]);
      }

      // Delete from Name table (try both singular and plural)
      let nameDeleteQuery;
      try {
        nameDeleteQuery = this.useMariaDB
          ? `DELETE FROM Name WHERE id = ?`
          : `DELETE FROM Name WHERE id = $1`;
        await this.query(nameDeleteQuery, [recipeId]);
      } catch (error) {
        // If 'Name' table doesn't exist, try 'Names'
        if (error.message && (error.message.includes("doesn't exist") || error.message.includes("Unknown table"))) {
          nameDeleteQuery = this.useMariaDB
            ? `DELETE FROM Names WHERE id = ?`
            : `DELETE FROM Names WHERE id = $1`;
          await this.query(nameDeleteQuery, [recipeId]);
        } else {
          throw error;
        }
      }

      return { message: 'Recipe deleted successfully' };
    } catch (error) {
      console.error('Error deleting recipe:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = DatabaseService;
