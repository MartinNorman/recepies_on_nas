const express = require('express');
const DatabaseService = require('../services/database');

const router = express.Router();
const db = new DatabaseService();

// POST /api/search/by-ingredients - Search recipes by ingredients
router.post('/by-ingredients', async (req, res) => {
  try {
    console.log('Received search request:', {
      method: req.method,
      path: req.path,
      body: req.body,
      contentType: req.get('Content-Type')
    });

    // Validate request body exists
    if (!req.body) {
      console.error('Request body is missing');
      return res.status(400).json({ 
        error: 'Request body is required',
        details: 'No request body received'
      });
    }

    const { ingredients, matchAll = false, page = 1, limit = 50 } = req.body;
    
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ 
        error: 'Ingredients array is required and cannot be empty' 
      });
    }

    // Normalize ingredient names (trim whitespace, lowercase)
    const normalizedIngredients = ingredients
      .map(ing => {
        if (typeof ing !== 'string') {
          return String(ing).trim().toLowerCase();
        }
        return ing.trim().toLowerCase();
      })
      .filter(ing => ing.length > 0);

    if (normalizedIngredients.length === 0) {
      return res.status(400).json({ 
        error: 'No valid ingredients provided' 
      });
    }

    // Validate pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    
    if (pageNum < 1) {
      return res.status(400).json({ 
        error: 'Page must be greater than 0' 
      });
    }
    
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 100' 
      });
    }

    console.log('Searching for ingredients:', normalizedIngredients, 'matchAll:', matchAll, 'page:', pageNum, 'limit:', limitNum);
    
    // Validate database service is available
    if (!db || typeof db.searchByIngredients !== 'function') {
      console.error('Database service not available');
      return res.status(500).json({ 
        error: 'Database service not available',
        details: 'Database connection issue'
      });
    }
    
    const searchResult = await db.searchByIngredients(normalizedIngredients, matchAll, pageNum, limitNum);
    console.log('Found recipes:', searchResult.results.length, 'Total:', searchResult.pagination.total);
    
    res.json({
      query: {
        ingredients: normalizedIngredients,
        matchAll,
        count: searchResult.pagination.total
      },
      results: searchResult.results || [],
      pagination: searchResult.pagination
    });
  } catch (error) {
    console.error('Error searching recipes:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Make sure we always send a response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to search recipes',
        details: error.message || 'Unknown error',
        type: error.name || 'Error'
      });
    }
  }
});

// GET /api/search/suggestions - Get ingredient suggestions (for autocomplete)
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const query = `
      SELECT DISTINCT ingredient 
      FROM Ingredients 
      WHERE LOWER(ingredient) LIKE LOWER($1)
      ORDER BY ingredient 
      LIMIT 10;
    `;
    
    const result = await db.query(query, [`%${q.trim()}%`]);
    const suggestions = result.rows.map(row => row.ingredient);
    
    console.log('Ingredient suggestions for:', q, 'found:', suggestions);
    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching ingredient suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// GET /api/search/debug - Debug endpoint to see all ingredients
router.get('/debug', async (req, res) => {
  try {
    const query = db.useMariaDB
      ? `SELECT DISTINCT ingredient FROM Ingredients ORDER BY ingredient`
      : `SELECT DISTINCT ingredient FROM Ingredients ORDER BY ingredient`;
    const result = await db.query(query);
    const ingredients = result.rows.map(row => row.ingredient);
    
    res.json({
      total_ingredients: ingredients.length,
      ingredients: ingredients
    });
  } catch (error) {
    console.error('Error fetching debug info:', error);
    res.status(500).json({ error: 'Failed to fetch debug info' });
  }
});

// GET /api/search/test - Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Search routes are working!', timestamp: new Date().toISOString() });
});

// GET /api/search/test-ingredient - Test if a specific ingredient exists
router.get('/test-ingredient', async (req, res) => {
  try {
    const { ingredient } = req.query;
    
    if (!ingredient) {
      return res.status(400).json({ error: 'Ingredient parameter is required' });
    }

    const normalizedIngredient = ingredient.trim().toLowerCase();
    
    // Test exact match (case-insensitive)
    const exactQuery = db.useMariaDB
      ? `SELECT * FROM Ingredients WHERE LOWER(TRIM(ingredient)) = ? LIMIT 5`
      : `SELECT * FROM Ingredients WHERE LOWER(TRIM(ingredient)) = $1 LIMIT 5`;
    const exactResult = await db.query(exactQuery, [normalizedIngredient]);
    
    // Test partial match
    const partialQuery = db.useMariaDB
      ? `SELECT * FROM Ingredients WHERE LOWER(TRIM(ingredient)) LIKE ? LIMIT 5`
      : `SELECT * FROM Ingredients WHERE LOWER(TRIM(ingredient)) LIKE $1 LIMIT 5`;
    const partialResult = await db.query(partialQuery, [`%${normalizedIngredient}%`]);
    
    res.json({
      searchTerm: normalizedIngredient,
      exactMatches: exactResult.rows.length,
      exactResults: exactResult.rows,
      partialMatches: partialResult.rows.length,
      partialResults: partialResult.rows
    });
  } catch (error) {
    console.error('Error testing ingredient:', error);
    res.status(500).json({ error: 'Failed to test ingredient', details: error.message });
  }
});

// GET /api/search/recipes - Quick search recipes by name
router.get('/recipes', async (req, res) => {
  try {
    const { q, page = 1, limit = 50 } = req.query;

    if (!q || q.trim().length < 2) {
      // Return recent recipes if no search query
      const names = await db.getNames();
      return res.json({
        query: '',
        results: names.slice(0, 10),
        pagination: {
          page: 1,
          limit: 10,
          total: names.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    // Validate pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    
    if (pageNum < 1) {
      return res.status(400).json({ 
        error: 'Page must be greater than 0' 
      });
    }
    
    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'Limit must be between 1 and 100' 
      });
    }

    const offset = (pageNum - 1) * limitNum;
    const searchTerm = q.trim();

    // Get total count first
    const countQuery = db.useMariaDB
      ? `SELECT COUNT(*) as total FROM Name WHERE LOWER(name) LIKE LOWER(?) OR LOWER(type) LIKE LOWER(?)`
      : `SELECT COUNT(*) as total FROM Name WHERE LOWER(name) LIKE LOWER($1) OR LOWER(type) LIKE LOWER($1)`;

    const countParams = db.useMariaDB
      ? [`%${searchTerm}%`, `%${searchTerm}%`]
      : [`%${searchTerm}%`];

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total) || 0;
    const totalPages = Math.ceil(total / limitNum);

    // Simple search - get matching recipes with pagination
    const searchQuery = db.useMariaDB
      ? `SELECT * FROM Name WHERE LOWER(name) LIKE LOWER(?) OR LOWER(type) LIKE LOWER(?) ORDER BY name ASC LIMIT ? OFFSET ?;`
      : `SELECT * FROM Name WHERE LOWER(name) LIKE LOWER($1) OR LOWER(type) LIKE LOWER($1) ORDER BY name ASC LIMIT $2 OFFSET $3;`;

    const searchParams = db.useMariaDB
      ? [`%${searchTerm}%`, `%${searchTerm}%`, limitNum, offset]
      : [`%${searchTerm}%`, limitNum, offset];

    const result = await db.query(searchQuery, searchParams);

    // Optimize: Fetch ingredients, cooking times, and ratings for all recipes in batch queries
    // This eliminates the N+1 query problem
    const recipesWithIngredients = [];
    
    if (result.rows.length > 0) {
      const recipeIds = result.rows.map(r => r.id);
      
      // Get all ingredients for all recipes at once
      let allIngredientsQuery;
      if (db.useMariaDB) {
        const placeholders = recipeIds.map(() => '?').join(',');
        allIngredientsQuery = `SELECT * FROM Ingredients WHERE id IN (${placeholders}) ORDER BY id`;
      } else {
        allIngredientsQuery = `SELECT * FROM Ingredients WHERE id = ANY($1::int[]) ORDER BY id`;
      }
      const allIngredientsResult = await db.query(
        allIngredientsQuery, 
        db.useMariaDB ? recipeIds : [recipeIds]
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
      if (db.useMariaDB) {
        const placeholders = recipeIds.map(() => '?').join(',');
        allCookingTimesQuery = `SELECT * FROM CookingTimes WHERE id IN (${placeholders})`;
      } else {
        allCookingTimesQuery = `SELECT * FROM CookingTimes WHERE id = ANY($1::int[])`;
      }
      const allCookingTimesResult = await db.query(
        allCookingTimesQuery,
        db.useMariaDB ? recipeIds : [recipeIds]
      );
      const cookingTimesByRecipe = {};
      allCookingTimesResult.rows.forEach(ct => {
        cookingTimesByRecipe[ct.id] = ct;
      });
      
      // Get all ratings at once
      let allRatingsQuery;
      if (db.useMariaDB) {
        const placeholders = recipeIds.map(() => '?').join(',');
        allRatingsQuery = `SELECT * FROM Ratings WHERE id IN (${placeholders})`;
      } else {
        allRatingsQuery = `SELECT * FROM Ratings WHERE id = ANY($1::int[])`;
      }
      const allRatingsResult = await db.query(
        allRatingsQuery,
        db.useMariaDB ? recipeIds : [recipeIds]
      );
      const ratingsByRecipe = {};
      allRatingsResult.rows.forEach(rating => {
        ratingsByRecipe[rating.id] = rating;
      });
      
      // Attach data to recipes
      result.rows.forEach(recipe => {
        recipe.ingredients = ingredientsByRecipe[recipe.id] || [];
        recipe.cooking_time = cookingTimesByRecipe[recipe.id] || null;
        recipe.rating = ratingsByRecipe[recipe.id] || null;
        recipesWithIngredients.push(recipe);
      });
    }

    res.json({
      query: searchTerm,
      results: recipesWithIngredients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error searching recipes by name:', error);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
});

module.exports = router;
