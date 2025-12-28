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

    const { ingredients, matchAll = false } = req.body;
    
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

    console.log('Searching for ingredients:', normalizedIngredients, 'matchAll:', matchAll);
    
    // Validate database service is available
    if (!db || typeof db.searchByIngredients !== 'function') {
      console.error('Database service not available');
      return res.status(500).json({ 
        error: 'Database service not available',
        details: 'Database connection issue'
      });
    }
    
    const recipes = await db.searchByIngredients(normalizedIngredients, matchAll);
    console.log('Found recipes:', recipes.length);
    
    res.json({
      query: {
        ingredients: normalizedIngredients,
        matchAll,
        count: recipes.length
      },
      results: recipes || []
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
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      // Return recent recipes if no search query
      const names = await db.getNames();
      return res.json(names.slice(0, 10));
    }

    // Simple search - get matching recipes first
    const searchQuery = db.useMariaDB
      ? `SELECT * FROM Name WHERE LOWER(name) LIKE LOWER(?) OR LOWER(type) LIKE LOWER(?) ORDER BY name ASC LIMIT 20;`
      : `SELECT * FROM Name WHERE LOWER(name) LIKE LOWER($1) OR LOWER(type) LIKE LOWER($1) ORDER BY name ASC LIMIT 20;`;

    const searchParams = db.useMariaDB
      ? [`%${q.trim()}%`, `%${q.trim()}%`]
      : [`%${q.trim()}%`];

    const result = await db.query(searchQuery, searchParams);

    // Fetch ingredients, cooking time, and rating for each recipe
    const recipesWithIngredients = [];
    for (const recipe of result.rows) {
      const ingredientsQuery = db.useMariaDB
        ? `SELECT * FROM Ingredients WHERE id = ? ORDER BY id;`
        : `SELECT * FROM Ingredients WHERE id = $1 ORDER BY id;`;
      const ingredientsResult = await db.query(ingredientsQuery, [recipe.id]);
      recipe.ingredients = ingredientsResult.rows;
      
      // Get cooking time
      const cookingTimeQuery = db.useMariaDB
        ? `SELECT * FROM CookingTimes WHERE id = ?`
        : `SELECT * FROM CookingTimes WHERE id = $1`;
      const cookingTimeResult = await db.query(cookingTimeQuery, [recipe.id]);
      recipe.cooking_time = cookingTimeResult.rows[0] || null;
      
      // Get rating
      const ratingQuery = db.useMariaDB
        ? `SELECT * FROM Ratings WHERE id = ?`
        : `SELECT * FROM Ratings WHERE id = $1`;
      const ratingResult = await db.query(ratingQuery, [recipe.id]);
      recipe.rating = ratingResult.rows[0] || null;
      
      recipesWithIngredients.push(recipe);
    }

    res.json({
      query: q.trim(),
      results: recipesWithIngredients
    });
  } catch (error) {
    console.error('Error searching recipes by name:', error);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
});

module.exports = router;
