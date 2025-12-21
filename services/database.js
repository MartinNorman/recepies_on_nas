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

  async searchByIngredients(ingredientNames, matchAll = false) {
    if (!ingredientNames || ingredientNames.length === 0) {
      return [];
    }

    console.log('Database search - ingredients:', ingredientNames, 'matchAll:', matchAll);

    let query;
    let params;

    if (this.useMariaDB) {
      // MariaDB version
      const fuzzyConditions = ingredientNames.map(() => 'i.ingredient LIKE ?').join(matchAll ? ' AND ' : ' OR ');

      if (matchAll) {
        query = `
          SELECT DISTINCT n.*, COUNT(DISTINCT i.ingredient) as matched_ingredients
          FROM Name n
          JOIN Ingredients i ON n.id = i.id
          WHERE ${fuzzyConditions}
          GROUP BY n.id, n.name, n.type
          HAVING COUNT(DISTINCT i.ingredient) >= ?
          ORDER BY matched_ingredients DESC, n.name ASC;
        `;
        params = [...ingredientNames.map(ing => `%${ing}%`), ingredientNames.length];
      } else {
        query = `
          SELECT DISTINCT n.*, COUNT(DISTINCT i.ingredient) as matched_ingredients
          FROM Name n
          JOIN Ingredients i ON n.id = i.id
          WHERE ${fuzzyConditions}
          GROUP BY n.id, n.name, n.type
          ORDER BY matched_ingredients DESC, n.name ASC;
        `;
        params = ingredientNames.map(ing => `%${ing}%`);
      }
    } else {
      // PostgreSQL version
      const fuzzyConditions = ingredientNames.map((_, index) => `i.ingredient ILIKE $${index + 1}`).join(matchAll ? ' AND ' : ' OR ');

      if (matchAll) {
        query = `
          SELECT DISTINCT n.*, COUNT(DISTINCT i.ingredient) as matched_ingredients
          FROM Name n
          JOIN Ingredients i ON n.id = i.id
          WHERE ${fuzzyConditions}
          GROUP BY n.id, n.name, n.type
          HAVING COUNT(DISTINCT i.ingredient) >= $${ingredientNames.length + 1}
          ORDER BY matched_ingredients DESC, n.name ASC;
        `;
        params = [...ingredientNames.map(ing => `%${ing}%`), ingredientNames.length];
      } else {
        query = `
          SELECT DISTINCT n.*, COUNT(DISTINCT i.ingredient) as matched_ingredients
          FROM Name n
          JOIN Ingredients i ON n.id = i.id
          WHERE ${fuzzyConditions}
          GROUP BY n.id, n.name, n.type
          ORDER BY matched_ingredients DESC, n.name ASC;
        `;
        params = ingredientNames.map(ing => `%${ing}%`);
      }
    }

    console.log('Executing query:', query);
    console.log('With params:', params);

    try {
      const result = await this.query(query, params);
      console.log('Query result:', result.rows.length, 'rows');

      // Get ingredients, cooking time, and rating for each recipe
      const recipesWithIngredients = [];
      for (const recipe of result.rows) {
        const ingredientsQuery = this.useMariaDB
          ? `SELECT * FROM Ingredients WHERE id = ? ORDER BY id;`
          : `SELECT * FROM Ingredients WHERE id = $1 ORDER BY id;`;
        const ingredientsResult = await this.query(ingredientsQuery, [recipe.id]);
        recipe.ingredients = ingredientsResult.rows;
        
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
        
        recipesWithIngredients.push(recipe);
      }

      return recipesWithIngredients;
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
        if (description) {
          try {
            nameQuery = this.useMariaDB
              ? `INSERT INTO Name (name, type, description) VALUES (?, ?, ?)`
              : `INSERT INTO Name (name, type, description) VALUES ($1, $2, $3) RETURNING *`;
            nameResult = await this.query(nameQuery, [name, type || null, description]);
          } catch (descError) {
            // If description column doesn't exist, try without it
            if (descError.message && (descError.message.includes("Unknown column") || descError.message.includes("column") && descError.message.includes("does not exist"))) {
              console.log('Description column not found, inserting without description');
              nameQuery = this.useMariaDB
                ? `INSERT INTO Name (name, type) VALUES (?, ?)`
                : `INSERT INTO Name (name, type) VALUES ($1, $2) RETURNING *`;
              nameResult = await this.query(nameQuery, [name, type || null]);
            } else {
              throw descError;
            }
          }
        } else {
          nameQuery = this.useMariaDB
            ? `INSERT INTO Name (name, type) VALUES (?, ?)`
            : `INSERT INTO Name (name, type) VALUES ($1, $2) RETURNING *`;
          nameResult = await this.query(nameQuery, [name, type || null]);
        }
      } catch (error) {
        // If 'Name' fails, try 'Names' (plural)
        if (error.message && (error.message.includes("doesn't exist") || error.message.includes("Unknown table"))) {
          try {
            // Try with description if provided
            if (description) {
              try {
                nameQuery = this.useMariaDB
                  ? `INSERT INTO Names (name, type, description) VALUES (?, ?, ?)`
                  : `INSERT INTO Names (name, type, description) VALUES ($1, $2, $3) RETURNING *`;
                nameResult = await this.query(nameQuery, [name, type || null, description]);
              } catch (descError) {
                // If description column doesn't exist, try without it
                if (descError.message && (descError.message.includes("Unknown column") || descError.message.includes("column") && descError.message.includes("does not exist"))) {
                  console.log('Description column not found in Names table, inserting without description');
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Names (name, type) VALUES (?, ?)`
                    : `INSERT INTO Names (name, type) VALUES ($1, $2) RETURNING *`;
                  nameResult = await this.query(nameQuery, [name, type || null]);
                } else if (descError.message && (descError.message.includes("doesn't have a default value") || descError.message.includes("Field 'id' doesn't have a default value"))) {
                  // Handle AUTO_INCREMENT issue for Names table
                  const maxIdQuery = this.useMariaDB
                    ? `SELECT COALESCE(MAX(id), 0) as max_id FROM Names`
                    : `SELECT COALESCE(MAX(id), 0) as max_id FROM Names`;
              const maxIdResult = await this.query(maxIdQuery);
              manualId = (this.useMariaDB 
                ? ((maxIdResult.rows[0] && maxIdResult.rows[0].max_id) || 0)
                : (parseInt((maxIdResult.rows[0] && maxIdResult.rows[0].max_id) || 0))) + 1;
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Names (id, name, type) VALUES (?, ?, ?)`
                    : `INSERT INTO Names (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
                  nameResult = await this.query(nameQuery, [manualId, name, type || null]);
                } else {
                  throw descError;
                }
              }
            } else {
              nameQuery = this.useMariaDB
                ? `INSERT INTO Names (name, type) VALUES (?, ?)`
                : `INSERT INTO Names (name, type) VALUES ($1, $2) RETURNING *`;
              nameResult = await this.query(nameQuery, [name, type || null]);
            }
          } catch (namesError) {
            // If Names table also has AUTO_INCREMENT issue, handle it
            if (namesError.message && (namesError.message.includes("doesn't have a default value") || namesError.message.includes("Field 'id' doesn't have a default value"))) {
              const maxIdQuery = this.useMariaDB
                ? `SELECT COALESCE(MAX(id), 0) as max_id FROM Names`
                : `SELECT COALESCE(MAX(id), 0) as max_id FROM Names`;
              const maxIdResult = await this.query(maxIdQuery);
              manualId = (this.useMariaDB 
                ? ((maxIdResult.rows[0] && maxIdResult.rows[0].max_id) || 0)
                : (parseInt((maxIdResult.rows[0] && maxIdResult.rows[0].max_id) || 0))) + 1;
              
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
        } else if (error.message && (error.message.includes("doesn't have a default value") || error.message.includes("Field 'id' doesn't have a default value"))) {
          // The id field doesn't have AUTO_INCREMENT - manually get the next ID
          console.log('AUTO_INCREMENT not set on id field, getting next ID manually');
          try {
            // Get the maximum ID from the table
            const maxIdQuery = this.useMariaDB
              ? `SELECT COALESCE(MAX(id), 0) as max_id FROM Name`
              : `SELECT COALESCE(MAX(id), 0) as max_id FROM "Name"`;
            const maxIdResult = await this.query(maxIdQuery);
            manualId = (this.useMariaDB 
              ? ((maxIdResult.rows[0] && maxIdResult.rows[0].max_id) || 0)
              : (parseInt((maxIdResult.rows[0] && maxIdResult.rows[0].max_id) || 0))) + 1;
            
            // Insert with explicit ID
            if (description) {
              try {
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Name (id, name, type, description) VALUES (?, ?, ?, ?)`
                    : `INSERT INTO "Name" (id, name, type, description) VALUES ($1, $2, $3, $4) RETURNING *`;
                nameResult = await this.query(nameQuery, [manualId, name, type || null, description]);
              } catch (descError) {
                // If description column doesn't exist, try without it
                if (descError.message && (descError.message.includes("Unknown column") || descError.message.includes("column") && descError.message.includes("does not exist"))) {
                  nameQuery = this.useMariaDB
                    ? `INSERT INTO Name (id, name, type) VALUES (?, ?, ?)`
                    : `INSERT INTO "Name" (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
                  nameResult = await this.query(nameQuery, [manualId, name, type || null]);
                } else {
                  throw descError;
                }
              }
            } else {
              nameQuery = this.useMariaDB
                ? `INSERT INTO Name (id, name, type) VALUES (?, ?, ?)`
                : `INSERT INTO "Name" (id, name, type) VALUES ($1, $2, $3) RETURNING *`;
              nameResult = await this.query(nameQuery, [manualId, name, type || null]);
            }
          } catch (manualIdError) {
            console.error('Error inserting with manual ID:', manualIdError);
            throw new Error('Database configuration error: The Name table id field must have AUTO_INCREMENT or be manually managed. Please run the database initialization script or fix the table structure.');
          }
        } else {
          throw error;
        }
      }
      
      // Get recipe ID - handle both MariaDB and PostgreSQL
      let recipeId;
      if (manualId) {
        // If we manually calculated the ID, use it
        recipeId = manualId;
      } else if (this.useMariaDB) {
        recipeId = nameResult.insertId;
        if (!recipeId && nameResult.rows && nameResult.rows.length > 0) {
          recipeId = nameResult.rows[0].id;
        }
      } else {
        recipeId = nameResult.rows[0].id;
      }
      
      if (!recipeId) {
        throw new Error('Failed to get recipe ID after insertion');
      }
      
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

      // Return the created recipe
      return await this.getRecipeById(recipeId);
    } catch (error) {
      console.error('Error creating recipe:', error);
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
