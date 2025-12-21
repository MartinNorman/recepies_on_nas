const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DatabaseService = require('../services/database');

const router = express.Router();
const db = new DatabaseService();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const imagesDir = path.join(__dirname, '..', 'images');
    // Ensure images directory exists
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    // Use recipe ID from request body or params, or generate a temporary name
    const recipeId = req.body.recipeId || req.params.id || Date.now();
    // Always save as .jpg
    cb(null, `${recipeId}.jpg`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// GET /api/tables/cookingtimes - Get all cooking times
router.get('/cookingtimes', async (req, res) => {
  try {
    const cookingTimes = await db.getCookingTimes();
    res.json(cookingTimes);
  } catch (error) {
    console.error('Error fetching cooking times:', error);
    res.status(500).json({ error: 'Failed to fetch cooking times' });
  }
});

// GET /api/tables/ingredients - Get all ingredients
router.get('/ingredients', async (req, res) => {
  try {
    const ingredients = await db.getIngredients();
    res.json(ingredients);
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

// GET /api/tables/instructions - Get all instructions
router.get('/instructions', async (req, res) => {
  try {
    const instructions = await db.getInstructions();
    res.json(instructions);
  } catch (error) {
    console.error('Error fetching instructions:', error);
    res.status(500).json({ error: 'Failed to fetch instructions' });
  }
});

// GET /api/tables/names - Get all names (with pagination)
router.get('/names', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    
    console.log('Fetching names - page:', page, 'limit:', limit);
    const names = await db.getNames(page, limit);
    console.log('Fetched names count:', names.length);
    
    const totalCount = await db.getNamesCount();
    console.log('Total count:', totalCount);
    
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      recipes: names,
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching names:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });
    res.status(500).json({ 
      error: 'Failed to fetch names',
      details: error.message 
    });
  }
});

// GET /api/tables/ratings - Get all ratings
router.get('/ratings', async (req, res) => {
  try {
    const ratings = await db.getRatings();
    res.json(ratings);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// GET /api/tables/names/:id - Get recipe details by ID
router.get('/names/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'Invalid recipe ID',
        details: `ID must be a number, got: ${id}`
      });
    }

    // Use the database service method which handles both MariaDB and PostgreSQL
    const recipe = await db.getRecipeById(id);
    
    if (!recipe) {
      return res.status(404).json({ 
        error: 'Recipe not found',
        details: `No recipe found with ID: ${id}`
      });
    }
    
    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe details:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    console.error('Recipe ID requested:', req.params.id);
    console.error('Database type:', db.useMariaDB ? 'MariaDB' : 'PostgreSQL');
    
    // Extract error message from various possible error formats
    let errorMessage = 'Unknown error occurred';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.toString && error.toString() !== '[object Object]') {
      errorMessage = error.toString();
    } else if (error.code) {
      errorMessage = `Database error: ${error.code}`;
    }
    
    const errorResponse = { 
      error: 'Failed to fetch recipe details',
      details: errorMessage
    };
    
    // Include additional error info for debugging
    if (error.code) {
      errorResponse.code = error.code;
    }
    if (error.sqlMessage) {
      errorResponse.sqlMessage = error.sqlMessage;
    }
    
    // Include stack trace in development or if explicitly requested
    if (process.env.NODE_ENV === 'development' || req.query.debug === 'true') {
      errorResponse.stack = error.stack;
    }
    
    res.status(500).json(errorResponse);
  }
});

// POST /api/tables/cookingtimes - Add new cooking time
router.post('/cookingtimes', async (req, res) => {
  try {
    const { time, timeunit } = req.body;
    
    if (!time || !timeunit) {
      return res.status(400).json({ 
        error: 'Time and timeunit are required' 
      });
    }

    const query = `
      INSERT INTO CookingTimes (time, timeunit)
      VALUES ($1, $2)
      RETURNING *;
    `;
    
    const result = await db.query(query, [time, timeunit]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating cooking time:', error);
    res.status(500).json({ error: 'Failed to create cooking time' });
  }
});

// POST /api/tables/ingredients - Add new ingredient
router.post('/ingredients', async (req, res) => {
  try {
    const { amount, amount_type, ingredient } = req.body;
    
    if (!ingredient) {
      return res.status(400).json({ 
        error: 'Ingredient name is required' 
      });
    }

    const query = `
      INSERT INTO Ingredients (amount, amount_type, ingredient)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    
    const result = await db.query(query, [amount, amount_type, ingredient]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ingredient:', error);
    res.status(500).json({ error: 'Failed to create ingredient' });
  }
});

// POST /api/tables/names - Create new recipe
router.post('/names', async (req, res) => {
  try {
    const recipeData = req.body;

    const recipe = await db.createRecipe(recipeData);
    res.status(201).json(recipe);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Failed to create recipe', details: error.message });
  }
});

// PUT /api/tables/names/:id - Update existing recipe
router.put('/names/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipeData = req.body;
    
    // Check if recipe exists
    const existingRecipe = await db.getRecipeById(id);
    if (!existingRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipe = await db.updateRecipe(id, recipeData);
    res.json(recipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: 'Failed to update recipe', details: error.message });
  }
});

// DELETE /api/tables/names/:id - Delete recipe
router.delete('/names/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if recipe exists
    const existingRecipe = await db.getRecipeById(id);
    if (!existingRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    await db.deleteRecipe(id);
    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe', details: error.message });
  }
});

// POST /api/tables/names/:id/image - Upload recipe image
router.post('/names/:id/image', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Verify recipe exists
    const recipe = await db.getRecipeById(id);
    if (!recipe) {
      // Delete uploaded file if recipe doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Ensure the file is named with the recipe ID
    const targetPath = path.join(__dirname, '..', 'images', `${id}.jpg`);
    if (req.file.path !== targetPath) {
      // If file exists with the target name, delete it first
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      // Rename the uploaded file to use the recipe ID
      fs.renameSync(req.file.path, targetPath);
    }

    res.json({ 
      message: 'Image uploaded successfully',
      imagePath: `/images/${id}.jpg`
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    // Delete file if there was an error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
});

// POST /api/tables/names/image - Upload image for new recipe (before recipe is created)
router.post('/names/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // For new recipes, we'll use a temporary ID and the client will need to rename it
    // after creating the recipe. For now, return the temp filename.
    const tempId = req.body.tempId || Date.now();
    const tempPath = path.join(__dirname, '..', 'images', `${tempId}.jpg`);
    
    // Rename the uploaded file to use temp ID
    if (req.file.path !== tempPath) {
      fs.renameSync(req.file.path, tempPath);
    }

    res.json({ 
      message: 'Image uploaded successfully',
      tempId: tempId,
      imagePath: `/images/${tempId}.jpg`
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
});

module.exports = router;
