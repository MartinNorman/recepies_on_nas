// Load environment variables first
// Use path to ensure we're loading from project root
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseService = require('../services/database');
const config = require('../config');

// Debug: Show what database name is being used (only in verbose mode or if mismatch)
if (process.argv.includes('--verbose') || process.argv.includes('-v') || 
    (config.database.database !== 'Recept' && config.database.database.toLowerCase() !== 'recept')) {
  console.log(`[DEBUG] DB_NAME from process.env: "${process.env.DB_NAME || '(not set)'}"`);
  console.log(`[DEBUG] Database name from config: "${config.database.database}"`);
  if (process.env.DB_NAME && process.env.DB_NAME !== config.database.database) {
    console.log(`[WARNING] Mismatch! .env has "${process.env.DB_NAME}" but config has "${config.database.database}"`);
  }
}

// ============================================================================
// CONFIGURATION - Adjust these settings as needed
// ============================================================================

// Poultry keywords to search for in ingredients (case-insensitive)
// Add or remove keywords here to fine-tune the detection
const POULTRY_KEYWORDS = [
  'kyckling',
  'höna',
  'tupp',
  'kalkon',
  'anka',
  'gås',
  'vaktel',
  'fasan',
  'poultry',
  'kyckling file',
  'kyckling lår',
  'kyckling vinge',
  'kycklingfärs',
  'kalkonfile',
  'ank bröst'
];

// Meat (Kött) keywords to search for in ingredients (case-insensitive)
const MEAT_KEYWORDS = [
  'kött',
  'nötkött',
  'fläsk',
  'gris',
  'griskött',
  'biff',
  'oxkött',
  'kalf',
  'kalvkött',
  'lamm',
  'lammkött',
  'får',
  'fårkött',
  'vilt',
  'älg',
  'älgkött',
  'hjort',
  'hjortkött',
  'ren',
  'renkött',
  'köttfärs',
  'nötfärs',
  'fläskfärs',
  'korv',
  'bacon',
  'skinka',
  'prosciutto',
  'serrano',
  'chorizo',
  'salami'
];

// Fish (Fisk) keywords to search for in ingredients (case-insensitive)
const FISH_KEYWORDS = [
  'fisk',
  'lax',
  'torsk',
  'sill',
  'strömming',
  'makrill',
  'röding',
  'abborre',
  'gös',
  'gädda',
  'sik',
  'haj',
  'tonfisk',
  'ansjovis',
  'sardiner',
  'räkor',
  'krabba',
  'hummer',
  'musslor',
  'ostron',
  'bläckfisk',
  'kalamari',
  'kräftor',
  'seafood',
  'fish',
  'salmon',
  'cod',
  'herring',
  'mackerel',
  'tuna',
  'anchovy',
  'sardine',
  'shrimp',
  'prawn',
  'crab',
  'lobster',
  'mussel',
  'oyster',
  'squid',
  'octopus',
  'crayfish'
];

// Drink (Drinkar) keywords to search for in ingredients (case-insensitive)
const DRINK_KEYWORDS = [
  'vodka',
  'gin',
  'whiskey',
  'whisky',
  'rom',
  'rum'
];

// Set to true to preview changes without updating the database
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

// Set to true to only update recipes where columns are currently NULL
const ONLY_UPDATE_NULL = process.argv.includes('--only-null') || process.argv.includes('-n');

// Set to true to show detailed ingredient matches
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Test mode: only process recipes with IDs in the specified range
const TEST_MODE = process.argv.includes('--test') || process.argv.includes('-t');
const TEST_ID_MIN = 1020;
const TEST_ID_MAX = 1030;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an ingredient contains any keywords from a given list
 * @param {string} ingredient - The ingredient name to check
 * @param {string[]} keywords - Array of keywords to search for
 * @returns {Object} - { isMatch: boolean, matchedKeywords: string[] }
 */
function checkForKeywords(ingredient, keywords) {
  if (!ingredient || typeof ingredient !== 'string') {
    return { isMatch: false, matchedKeywords: [] };
  }

  const lowerIngredient = ingredient.toLowerCase().trim();
  const matchedKeywords = [];

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    // Check if keyword appears anywhere in the ingredient (as substring)
    // Escape special regex characters in the keyword
    const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use simple substring match instead of word boundaries
    if (lowerIngredient.includes(lowerKeyword)) {
      matchedKeywords.push(keyword);
    }
  }

  return {
    isMatch: matchedKeywords.length > 0,
    matchedKeywords: [...new Set(matchedKeywords)] // Remove duplicates
  };
}

/**
 * Check if an ingredient contains any poultry keywords
 * @param {string} ingredient - The ingredient name to check
 * @returns {Object} - { isPoultry: boolean, matchedKeywords: string[] }
 */
function checkForPoultry(ingredient) {
  const result = checkForKeywords(ingredient, POULTRY_KEYWORDS);
  return {
    isPoultry: result.isMatch,
    matchedKeywords: result.matchedKeywords
  };
}

/**
 * Check if an ingredient contains any meat keywords
 * @param {string} ingredient - The ingredient name to check
 * @returns {Object} - { isMeat: boolean, matchedKeywords: string[] }
 */
function checkForMeat(ingredient) {
  const result = checkForKeywords(ingredient, MEAT_KEYWORDS);
  return {
    isMeat: result.isMatch,
    matchedKeywords: result.matchedKeywords
  };
}

/**
 * Check if an ingredient contains any fish keywords
 * @param {string} ingredient - The ingredient name to check
 * @returns {Object} - { isFish: boolean, matchedKeywords: string[] }
 */
function checkForFish(ingredient) {
  const result = checkForKeywords(ingredient, FISH_KEYWORDS);
  return {
    isFish: result.isMatch,
    matchedKeywords: result.matchedKeywords
  };
}

/**
 * Check if an ingredient contains any drink keywords
 * @param {string} ingredient - The ingredient name to check
 * @returns {Object} - { isDrink: boolean, matchedKeywords: string[] }
 */
function checkForDrink(ingredient) {
  const result = checkForKeywords(ingredient, DRINK_KEYWORDS);
  return {
    isDrink: result.isMatch,
    matchedKeywords: result.matchedKeywords
  };
}

/**
 * Analyze a recipe for all categories (Poultry, Meat, Fish, Drink)
 * @param {Array} ingredients - Array of ingredient objects
 * @returns {Object} - { hasPoultry: boolean, hasMeat: boolean, hasFish: boolean, hasDrink: boolean, matchedIngredients: Object, allMatches: Object }
 */
function analyzeRecipeForCategories(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return {
      hasPoultry: false,
      hasMeat: false,
      hasFish: false,
      hasDrink: false,
      matchedIngredients: {
        poultry: [],
        meat: [],
        fish: [],
        drink: []
      },
      allMatches: {
        poultry: [],
        meat: [],
        fish: [],
        drink: []
      }
    };
  }

  const matchedIngredients = {
    poultry: [],
    meat: [],
    fish: [],
    drink: []
  };
  const allMatches = {
    poultry: [],
    meat: [],
    fish: [],
    drink: []
  };

  for (const ingredient of ingredients) {
    const ingredientName = ingredient.ingredient || ingredient.name || '';
    
    // Check for poultry
    const poultryResult = checkForPoultry(ingredientName);
    if (poultryResult.isPoultry) {
      matchedIngredients.poultry.push({
        ingredient: ingredientName,
        matchedKeywords: poultryResult.matchedKeywords
      });
      allMatches.poultry.push(...poultryResult.matchedKeywords);
    }
    
    // Check for meat
    const meatResult = checkForMeat(ingredientName);
    if (meatResult.isMeat) {
      matchedIngredients.meat.push({
        ingredient: ingredientName,
        matchedKeywords: meatResult.matchedKeywords
      });
      allMatches.meat.push(...meatResult.matchedKeywords);
    }
    
    // Check for fish
    const fishResult = checkForFish(ingredientName);
    if (fishResult.isFish) {
      matchedIngredients.fish.push({
        ingredient: ingredientName,
        matchedKeywords: fishResult.matchedKeywords
      });
      allMatches.fish.push(...fishResult.matchedKeywords);
    }
    
    // Check for drink
    const drinkResult = checkForDrink(ingredientName);
    if (drinkResult.isDrink) {
      matchedIngredients.drink.push({
        ingredient: ingredientName,
        matchedKeywords: drinkResult.matchedKeywords
      });
      allMatches.drink.push(...drinkResult.matchedKeywords);
    }
  }

  return {
    hasPoultry: matchedIngredients.poultry.length > 0,
    hasMeat: matchedIngredients.meat.length > 0,
    hasFish: matchedIngredients.fish.length > 0,
    hasDrink: matchedIngredients.drink.length > 0,
    matchedIngredients,
    allMatches: {
      poultry: [...new Set(allMatches.poultry)],
      meat: [...new Set(allMatches.meat)],
      fish: [...new Set(allMatches.fish)],
      drink: [...new Set(allMatches.drink)]
    }
  };
}

/**
 * Determine if a recipe contains poultry based on its ingredients
 * @param {Array} ingredients - Array of ingredient objects
 * @returns {Object} - { hasPoultry: boolean, matchedIngredients: Array, allMatches: Array }
 * @deprecated Use analyzeRecipeForCategories instead
 */
function analyzeRecipeForPoultry(ingredients) {
  const analysis = analyzeRecipeForCategories(ingredients);
  return {
    hasPoultry: analysis.hasPoultry,
    matchedIngredients: analysis.matchedIngredients.poultry,
    allMatches: analysis.allMatches.poultry
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function populateCategories() {
  const db = new DatabaseService();
  
  try {
    console.log('🍖🐟🐔🍹 Starting Recipe Category Population (Kött, Fisk, Fågel, Drinkar)');
    console.log('='.repeat(60));
    console.log(`Configuration:`);
    console.log(`  - Dry Run: ${DRY_RUN ? 'YES (no changes will be made)' : 'NO (will update database)'}`);
    console.log(`  - Only Update NULL: ${ONLY_UPDATE_NULL ? 'YES' : 'NO'}`);
    console.log(`  - Verbose: ${VERBOSE ? 'YES' : 'NO'}`);
    console.log(`  - Test Mode: ${TEST_MODE ? `YES (IDs ${TEST_ID_MIN}-${TEST_ID_MAX})` : 'NO'}`);
    console.log(`  - Poultry Keywords: ${POULTRY_KEYWORDS.length} keywords configured`);
    console.log(`  - Meat Keywords: ${MEAT_KEYWORDS.length} keywords configured`);
    console.log(`  - Fish Keywords: ${FISH_KEYWORDS.length} keywords configured`);
    console.log(`  - Drink Keywords: ${DRINK_KEYWORDS.length} keywords configured`);
    console.log(`  - Database Type: ${db.useMariaDB ? 'MariaDB/MySQL' : 'PostgreSQL'}`);
    console.log(`  - Database Host: ${config.database.host}`);
    console.log(`  - Database Port: ${config.database.port}`);
    console.log(`  - Database Name: ${config.database.database}`);
    if (config.database.database !== 'Recept' && config.database.database.toLowerCase() !== 'recept') {
      console.log(`  ⚠️  WARNING: Database name is "${config.database.database}" but expected "Recept"`);
      console.log(`     Please check your .env file (DB_NAME) or config file`);
    }
    console.log('='.repeat(60));
    console.log('');

    // Test database connection first
    console.log('📋 Step 0: Testing database connection...');
    try {
      const testQuery = db.useMariaDB
        ? `SELECT 1 as test;`
        : `SELECT 1 as test;`;
      await db.query(testQuery);
      console.log('   ✅ Database connection successful');
    } catch (error) {
      console.error('   ❌ Database connection failed!');
      console.error(`   Error: ${error.message}`);
      console.error('');
      console.error('   Current connection settings:');
      console.error(`      - DB_TYPE: ${config.database.type}`);
      console.error(`      - DB_HOST: ${config.database.host}`);
      console.error(`      - DB_PORT: ${config.database.port}`);
      console.error(`      - DB_NAME: ${config.database.database}`);
      console.error(`      - DB_USER: ${config.database.user}`);
      console.error('');
      console.error('   Troubleshooting steps:');
      console.error('');
      console.error('   1. Verify MariaDB/MySQL is running:');
      if (process.platform === 'win32') {
        console.error('      - Open Services (services.msc) and check if MariaDB/MySQL service is running');
        console.error('      - Or check Task Manager for mysqld.exe or mariadbd.exe');
      } else {
        console.error('      - Run: sudo systemctl status mariadb (or mysql)');
        console.error('      - Or: ps aux | grep mysql');
      }
      console.error('');
      console.error('   2. Check if the port is correct:');
      console.error(`      - Current port: ${config.database.port}`);
      console.error('      - Default MariaDB port is 3306, but you\'re using 3307');
      console.error('      - Try connecting manually: mysql -h 127.0.0.1 -P 3307 -u recept_user -p');
      console.error('');
      console.error('   3. Verify connection settings in .env file:');
      console.error('      - Make sure .env file exists in the project root');
      console.error('      - Check that DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD are correct');
      console.error('');
      console.error('   4. Test with the test script:');
      console.error('      - Run: node test-db.js');
      console.error('      - This will show if the basic connection works');
      console.error('');
      console.error('   5. If the main app is running, the database should be accessible');
      console.error('      - Try starting the main app first: npm start');
      console.error('      - If the app connects, then run this script again');
      throw new Error(`Database connection failed: ${error.message}`);
    }
    console.log('');

    // Step 1: Check if all category columns exist, add them if not
    console.log('📋 Step 1: Checking for category columns (Kött, Fisk, Fågel)...');
    
    // Verify the table exists by trying to query it
    // User confirmed: database is "Recept", table is "Name" with column "id"
    let actualTableName = 'Name';
    let tableNameForQuery = 'Name'; // For queries
    
    try {
      // Test if we can access the Name table
      const testQuery = db.useMariaDB
        ? `SELECT id FROM Name LIMIT 1;`
        : `SELECT id FROM "Name" LIMIT 1;`;
      await db.query(testQuery);
      console.log(`   ✅ Verified table "Name" exists and is accessible`);
      tableNameForQuery = db.useMariaDB ? 'Name' : '"Name"';
    } catch (error) {
      console.error(`   ❌ Error accessing table "Name": ${error.message}`);
      console.error(`   💡 Please verify:`);
      console.error(`      - Current database in config: ${config.database.database}`);
      console.error(`      - Expected database: Recept`);
      console.error(`      - Table name: Name (with capital N)`);
      console.error(`      - Table has column: id`);
      console.error(`   ⚠️  IMPORTANT: The script is connecting to database "${config.database.database}"`);
      console.error(`      but you mentioned the database should be "Recept".`);
      console.error(`      Please check your .env file or config file and update DB_NAME to "Recept"`);
      throw new Error(`Cannot access table "Name" in database "${config.database.database}". Expected database: "Recept". Please check your .env file (DB_NAME) or config. Original error: ${error.message}`);
    }
    
    const columnsToCheck = [
      { name: 'Fågel', dbName: db.useMariaDB ? 'Poultry' : 'poultry', displayName: 'Fågel (Poultry)' },
      { name: 'Kött', dbName: db.useMariaDB ? 'Meat' : 'meat', displayName: 'Kött (Meat)' },
      { name: 'Fisk', dbName: db.useMariaDB ? 'Fish' : 'fish', displayName: 'Fisk (Fish)' }
    ];
    
    const columnNames = {};
    
    for (const col of columnsToCheck) {
      try {
        let columnExists = false;
        let columnName = col.dbName;
        
        if (db.useMariaDB) {
          // MariaDB/MySQL - check for column (case-sensitive in some setups)
          const checkColumnQuery = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = ? 
            AND (COLUMN_NAME = ? OR COLUMN_NAME = LOWER(?));
          `;
          const result = await db.query(checkColumnQuery, [config.database.database, actualTableName, col.dbName, col.dbName]);
          columnExists = result.rows.length > 0;
          if (columnExists) {
            columnName = result.rows[0].COLUMN_NAME; // Use actual column name
          }
        } else {
          // PostgreSQL - check for column
          const lowerColName = col.dbName.toLowerCase();
          const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'Name' 
            AND (LOWER(column_name) = $1 OR column_name = $2);
          `;
          const result = await db.query(checkColumnQuery, [lowerColName, col.dbName]);
          columnExists = result.rows.length > 0;
          if (columnExists) {
            columnName = result.rows[0].column_name.toLowerCase(); // Normalize to lowercase
          }
        }

        if (!columnExists) {
          console.log(`   ⚠️  ${col.displayName} column not found. Adding it...`);
          if (!DRY_RUN) {
            // Use the verified table name for ALTER TABLE
            const addColumnQuery = `ALTER TABLE ${tableNameForQuery} ADD COLUMN ${col.dbName} BOOLEAN DEFAULT FALSE;`;
            await db.query(addColumnQuery);
            console.log(`   ✅ ${col.displayName} column added successfully`);
            columnName = col.dbName;
          } else {
            console.log(`   [DRY RUN] Would add ${col.displayName} column`);
          }
        } else {
          console.log(`   ✅ ${col.displayName} column already exists (as "${columnName}")`);
        }
        
        columnNames[col.name] = columnName;
      } catch (error) {
        console.error(`   ❌ Error checking/adding ${col.displayName} column:`, error.message);
        throw error;
      }
    }

    console.log('');

    // Step 2: Fetch all recipes
    console.log('📋 Step 2: Fetching recipes...');
    
    let recipesQuery;
    let recipesResult;
    
    if (TEST_MODE) {
      // Test mode: only fetch recipes with IDs in the test range
      recipesQuery = db.useMariaDB
        ? `SELECT id, name, type, ${columnNames['Fågel']} AS Fågel, ${columnNames['Kött']} AS Kött, ${columnNames['Fisk']} AS Fisk 
           FROM Name 
           WHERE id >= ? AND id <= ? 
           ORDER BY id;`
        : `SELECT id, name, type, ${columnNames['Fågel']} AS "Fågel", ${columnNames['Kött']} AS "Kött", ${columnNames['Fisk']} AS "Fisk" 
           FROM ${tableNameForQuery} 
           WHERE id >= $1 AND id <= $2 
           ORDER BY id;`;
      recipesResult = await db.query(recipesQuery, [TEST_ID_MIN, TEST_ID_MAX]);
    } else {
      recipesQuery = db.useMariaDB
        ? `SELECT id, name, type, ${columnNames['Fågel']} AS Fågel, ${columnNames['Kött']} AS Kött, ${columnNames['Fisk']} AS Fisk 
           FROM Name 
           ORDER BY id;`
        : `SELECT id, name, type, ${columnNames['Fågel']} AS "Fågel", ${columnNames['Kött']} AS "Kött", ${columnNames['Fisk']} AS "Fisk" 
           FROM ${tableNameForQuery} 
           ORDER BY id;`;
      recipesResult = await db.query(recipesQuery);
    }
    
    const recipes = recipesResult.rows;
    
    if (TEST_MODE) {
      console.log(`   ✅ Found ${recipes.length} recipes in test range (IDs ${TEST_ID_MIN}-${TEST_ID_MAX})`);
    } else {
      console.log(`   ✅ Found ${recipes.length} recipes`);
    }

    if (recipes.length === 0) {
      console.log('   ⚠️  No recipes found. Exiting.');
      return;
    }

    console.log('');

    // Step 3: Analyze each recipe
    console.log('📋 Step 3: Analyzing recipes for category ingredients (Kött, Fisk, Fågel)...');
    console.log(`   Processing ${recipes.length} recipes...`);
    console.log('   ⏳ Fetching all ingredients in batch...');
    
    // OPTIMIZATION: Fetch all ingredients in one batch query instead of one per recipe
    const recipeIds = recipes.map(r => r.id);
    let allIngredientsByRecipe = {};
    
    try {
      // Try with id = recipe id first
      let ingredientsQuery;
      if (db.useMariaDB) {
        // MariaDB: Use IN clause with placeholders
        const placeholders = recipeIds.map(() => '?').join(',');
        ingredientsQuery = `SELECT * FROM Ingredients WHERE id IN (${placeholders}) ORDER BY id;`;
      } else {
        // PostgreSQL: Use ANY array for better performance
        ingredientsQuery = `SELECT * FROM Ingredients WHERE id = ANY($1::int[]) ORDER BY id;`;
      }
      
      const ingredientsResult = await db.query(
        ingredientsQuery, 
        db.useMariaDB ? recipeIds : [recipeIds]
      );
      
      // Group ingredients by recipe ID
      ingredientsResult.rows.forEach(ing => {
        const recipeId = ing.id;
        if (!allIngredientsByRecipe[recipeId]) {
          allIngredientsByRecipe[recipeId] = [];
        }
        allIngredientsByRecipe[recipeId].push(ing);
      });
      
      console.log(`   ✅ Fetched ingredients for ${Object.keys(allIngredientsByRecipe).length} recipes`);
    } catch (error) {
      // Fallback: try with recipe_id if id doesn't work
      console.log(`   ⚠️  Batch fetch with id failed, trying recipe_id...`);
      try {
        let ingredientsQuery;
        if (db.useMariaDB) {
          const placeholders = recipeIds.map(() => '?').join(',');
          ingredientsQuery = `SELECT * FROM Ingredients WHERE recipe_id IN (${placeholders}) ORDER BY recipe_id;`;
        } else {
          ingredientsQuery = `SELECT * FROM Ingredients WHERE recipe_id = ANY($1::int[]) ORDER BY recipe_id;`;
        }
        
        const ingredientsResult = await db.query(
          ingredientsQuery,
          db.useMariaDB ? recipeIds : [recipeIds]
        );
        
        ingredientsResult.rows.forEach(ing => {
          const recipeId = ing.recipe_id;
          if (!allIngredientsByRecipe[recipeId]) {
            allIngredientsByRecipe[recipeId] = [];
          }
          allIngredientsByRecipe[recipeId].push(ing);
        });
        
        console.log(`   ✅ Fetched ingredients for ${Object.keys(allIngredientsByRecipe).length} recipes`);
      } catch (error2) {
        console.error(`   ❌ Error fetching ingredients in batch: ${error2.message}`);
        console.error(`   💡 Falling back to individual queries (slower)`);
        allIngredientsByRecipe = {}; // Will trigger fallback
      }
    }
    
    console.log('');

    let updatedCount = 0;
    let skippedCount = 0;
    let unchangedCount = 0;
    let processedCount = 0;
    const updates = {
      fågel: [],
      kött: [],
      fisk: [],
      recipes: [] // Grouped by recipe for batch updates
    };

    const totalRecipes = recipes.length;
    const logInterval = Math.max(1, Math.floor(totalRecipes / 100)); // Log every 1% progress
    const startTime = Date.now();

    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i];
      processedCount++;
      
      // Progress logging - show more frequently for large datasets
      if (processedCount % logInterval === 0 || processedCount === 1 || processedCount === totalRecipes || processedCount % 100 === 0) {
        const percent = Math.round((processedCount / totalRecipes) * 100);
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const rate = elapsed > 0 ? processedCount / elapsed : 0; // recipes per second (avoid division by zero)
        const remaining = totalRecipes - processedCount;
        const eta = rate > 0 ? remaining / rate : 0; // estimated seconds remaining
        const etaMinutes = Math.floor(eta / 60);
        const etaSeconds = Math.floor(eta % 60);
        
        const rateDisplay = rate > 0 ? `${rate.toFixed(1)} recipes/sec` : 'calculating...';
        const etaDisplay = rate > 0 ? `${etaMinutes}m ${etaSeconds}s` : 'calculating...';
        
        process.stdout.write(`   Progress: ${processedCount}/${totalRecipes} (${percent}%) | Speed: ${rateDisplay} | ETA: ${etaDisplay} | Recipe #${recipe.id}\r`);
      }

      // Skip if only updating NULL and this recipe already has values for all categories
      if (ONLY_UPDATE_NULL) {
        const hasAllValues = (recipe.Fågel !== null && recipe.Fågel !== undefined) &&
                            (recipe.Kött !== null && recipe.Kött !== undefined) &&
                            (recipe.Fisk !== null && recipe.Fisk !== undefined);
        if (hasAllValues) {
          skippedCount++;
          if (VERBOSE) {
            console.log(`\n   ⏭️  Skipped recipe #${recipe.id}: "${recipe.name}" (already has all category values)`);
          }
          continue;
        }
      }

      // Get ingredients from batch fetch, or fetch individually if batch failed
      let ingredients = allIngredientsByRecipe[recipe.id] || [];
      
      // Fallback: fetch individually if batch didn't work
      if (ingredients.length === 0 && Object.keys(allIngredientsByRecipe).length === 0) {
        if (VERBOSE) {
          console.log(`\n   📝 Recipe #${recipe.id}: "${recipe.name}"`);
          console.log(`      Fetching ingredients...`);
        }
        
        const ingredientsQuery = db.useMariaDB
          ? `SELECT * FROM Ingredients WHERE id = ? ORDER BY id;`
          : `SELECT * FROM Ingredients WHERE id = $1 ORDER BY id;`;
        
        try {
          const ingredientsResult = await db.query(ingredientsQuery, [recipe.id]);
          ingredients = ingredientsResult.rows;
        } catch (error) {
          console.error(`\n   ❌ Error fetching ingredients for recipe #${recipe.id}: ${error.message}`);
          unchangedCount++;
          continue;
        }
      }

      // Analyze recipe for all categories
      if (VERBOSE) {
        console.log(`      Analyzing for category keywords (Kött, Fisk, Fågel)...`);
      }
      
      const analysis = analyzeRecipeForCategories(ingredients);

      // Check each category and determine if updates are needed
      const categories = [
        { 
          name: 'Fågel', 
          dbColumn: columnNames['Fågel'],
          hasCategory: analysis.hasPoultry,
          currentValue: recipe.Fågel === true || recipe.Fågel === 1 || recipe.Fågel === '1',
          matchedIngredients: analysis.matchedIngredients.poultry,
          matchedKeywords: analysis.allMatches.poultry,
          emoji: '🐔'
        },
        { 
          name: 'Kött', 
          dbColumn: columnNames['Kött'],
          hasCategory: analysis.hasMeat,
          currentValue: recipe.Kött === true || recipe.Kött === 1 || recipe.Kött === '1',
          matchedIngredients: analysis.matchedIngredients.meat,
          matchedKeywords: analysis.allMatches.meat,
          emoji: '🍖'
        },
        { 
          name: 'Fisk', 
          dbColumn: columnNames['Fisk'],
          hasCategory: analysis.hasFish,
          currentValue: recipe.Fisk === true || recipe.Fisk === 1 || recipe.Fisk === '1',
          matchedIngredients: analysis.matchedIngredients.fish,
          matchedKeywords: analysis.allMatches.fish,
          emoji: '🐟'
        }
      ];

      let recipeNeedsUpdate = false;
      const recipeUpdates = {
        recipeId: recipe.id,
        recipeName: recipe.name,
        categories: {}
      };
      
      for (const category of categories) {
        const needsUpdate = category.currentValue !== category.hasCategory;
        
        if (needsUpdate) {
          recipeNeedsUpdate = true;
          recipeUpdates.categories[category.name] = {
            category: category.name,
            dbColumn: category.dbColumn,
            currentValue: category.currentValue,
            newValue: category.hasCategory,
            matchedIngredients: category.matchedIngredients,
            matchedKeywords: category.matchedKeywords
          };
          
          // Also add to individual category updates for summary
          updates[category.name.toLowerCase()].push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            category: category.name,
            dbColumn: category.dbColumn,
            currentValue: category.currentValue,
            newValue: category.hasCategory,
            matchedIngredients: category.matchedIngredients,
            matchedKeywords: category.matchedKeywords
          });
          
          if (VERBOSE) {
            console.log(`      ${category.emoji} ${category.name}: ${category.currentValue ? 'TRUE' : 'FALSE'} → ${category.hasCategory ? 'TRUE' : 'FALSE'}`);
            if (category.matchedIngredients.length > 0) {
              console.log(`         Matched: ${category.matchedIngredients.map(m => m.ingredient).join(', ')}`);
            }
          }
        } else if (VERBOSE && category.hasCategory) {
          console.log(`      ${category.emoji} ${category.name}: No change needed (${category.currentValue ? 'TRUE' : 'FALSE'})`);
        }
      }

      // Check if recipe should be set to "Drink" type
      const shouldSetDrink = analysis.hasDrink;
      const needsTypeUpdate = shouldSetDrink && recipe.type !== 'Drink';
      
      if (VERBOSE && shouldSetDrink) {
        console.log(`      🍹 Drink: Type "${recipe.type || '(null)'}" → "Drink"`);
        if (analysis.matchedIngredients.drink.length > 0) {
          console.log(`         Matched: ${analysis.matchedIngredients.drink.map(m => m.ingredient).join(', ')}`);
        }
      }
      
      // If recipe needs update, determine if type should be set to "Varmrätt" or "Drink"
      if (recipeNeedsUpdate || needsTypeUpdate) {
        if (needsTypeUpdate) {
          recipeNeedsUpdate = true; // Ensure we update this recipe
        }
        
        // Drinks take priority - if it's a drink, set type to "Drink"
        // Otherwise, if it has meat/fish/poultry categories, set to "Varmrätt"
        if (shouldSetDrink) {
          recipeUpdates.shouldSetDrink = true;
          recipeUpdates.matchedDrinkIngredients = analysis.matchedIngredients.drink;
          recipeUpdates.matchedDrinkKeywords = analysis.allMatches.drink;
        } else {
          const hasAnyCategory = analysis.hasPoultry || analysis.hasMeat || analysis.hasFish;
          recipeUpdates.shouldSetVarmratt = hasAnyCategory;
        }
        recipeUpdates.currentType = recipe.type;
        updatedCount++;
      } else {
        unchangedCount++;
      }
      
      // Store recipe update if needed
      if (recipeNeedsUpdate) {
        if (!updates.recipes) {
          updates.recipes = [];
        }
        updates.recipes.push(recipeUpdates);
      }
    }
    
    // Clear the progress line and show completion
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgRate = (processedCount / (Date.now() - startTime) * 1000).toFixed(1);
    process.stdout.write('   ' + ' '.repeat(100) + '\r');
    console.log(`   ✅ Analysis complete! Processed ${processedCount} recipes in ${totalTime} seconds (${avgRate} recipes/sec)`);
    console.log('');
    // Count drink type updates
    const drinkTypeUpdates = (updates.recipes || []).filter(r => r.shouldSetDrink).length;
    
    console.log(`   📊 Analysis Summary:`);
    console.log(`      - Total recipes processed: ${processedCount}`);
    console.log(`      - Recipes with updates needed: ${updatedCount}`);
    console.log(`      - Recipes unchanged: ${unchangedCount}`);
    console.log(`      - Recipes skipped: ${skippedCount}`);
    console.log(`      - Fågel updates: ${updates.fågel.length}`);
    console.log(`      - Kött updates: ${updates.kött.length}`);
    console.log(`      - Fisk updates: ${updates.fisk.length}`);
    console.log(`      - Drink type updates: ${drinkTypeUpdates}`);
    
    const totalUpdates = updates.fågel.length + updates.kött.length + updates.fisk.length + drinkTypeUpdates;
    if (totalUpdates > 0) {
      console.log('');
      console.log(`   📝 Sample of recipes that will be updated (showing first 10):`);
      const allCategoryUpdates = [...updates.fågel, ...updates.kött, ...updates.fisk];
      const allDrinkUpdates = (updates.recipes || [])
        .filter(r => r.shouldSetDrink)
        .map(r => ({
          recipeId: r.recipeId,
          recipeName: r.recipeName,
          category: 'Drink',
          matchedIngredients: r.matchedDrinkIngredients || []
        }));
      const allUpdates = [...allCategoryUpdates, ...allDrinkUpdates].slice(0, 10);
      allUpdates.forEach((update, idx) => {
        const matchInfo = update.matchedIngredients && update.matchedIngredients.length > 0 
          ? ` (matched: ${update.matchedIngredients.slice(0, 2).map(m => m.ingredient || m).join(', ')}${update.matchedIngredients.length > 2 ? '...' : ''})`
          : '';
        const emoji = update.category === 'Fågel' ? '🐔' : update.category === 'Kött' ? '🍖' : update.category === 'Fisk' ? '🐟' : '🍹';
        const categoryInfo = update.category === 'Drink' 
          ? `[Type → Drink]`
          : `[${update.category}] (${update.currentValue ? 'TRUE' : 'FALSE'} → ${update.newValue ? 'TRUE' : 'FALSE'})`;
        console.log(`      ${idx + 1}. ${emoji} #${update.recipeId}: "${update.recipeName.substring(0, 40)}${update.recipeName.length > 40 ? '...' : ''}" ${categoryInfo}${matchInfo}`);
      });
      if (totalUpdates > 10) {
        console.log(`      ... and ${totalUpdates - 10} more updates`);
      }
    }
    console.log('');

    // Step 4: Update database
    if (totalUpdates > 0) {
      const recipeCount = (updates.recipes || []).length;
      console.log('📋 Step 4: Updating database...');
      console.log(`   Found ${recipeCount} recipes to update (${totalUpdates} total category updates)`);
      console.log('');

      if (DRY_RUN) {
        console.log('   [DRY RUN MODE - No changes will be made]');
        console.log('');
        console.log('   Recipes that would be updated:');
        const recipeUpdates = updates.recipes || [];
        recipeUpdates.forEach((recipeUpdate, index) => {
          const categoryList = Object.keys(recipeUpdate.categories).map(cat => {
            const emoji = cat === 'Fågel' ? '🐔' : cat === 'Kött' ? '🍖' : '🐟';
            const catData = recipeUpdate.categories[cat];
            return `${emoji}${cat}: ${catData.currentValue ? 'TRUE' : 'FALSE'} → ${catData.newValue ? 'TRUE' : 'FALSE'}`;
          }).join(', ');
          
          console.log(`   ${index + 1}. Recipe #${recipeUpdate.recipeId}: "${recipeUpdate.recipeName}"`);
          if (categoryList) {
            console.log(`      Categories: ${categoryList}`);
          }
          if (recipeUpdate.shouldSetDrink) {
            console.log(`      Type: "${recipeUpdate.currentType || '(null)'}" → "Drink"`);
          } else if (recipeUpdate.shouldSetVarmratt) {
            console.log(`      Type: "${recipeUpdate.currentType || '(null)'}" → "Varmrätt"`);
          }
          
          // Show matched ingredients
          const allMatched = [];
          Object.values(recipeUpdate.categories || {}).forEach(catData => {
            if (catData.matchedIngredients && catData.matchedIngredients.length > 0) {
              allMatched.push(...catData.matchedIngredients.map(m => m.ingredient));
            }
          });
          // Also show drink ingredients if present
          if (recipeUpdate.matchedDrinkIngredients && recipeUpdate.matchedDrinkIngredients.length > 0) {
            allMatched.push(...recipeUpdate.matchedDrinkIngredients.map(m => m.ingredient));
          }
          if (allMatched.length > 0) {
            console.log(`      Matched ingredients: ${[...new Set(allMatched)].join(', ')}`);
          }
          console.log('');
        });
      } else {
        let successCount = 0;
        let errorCount = 0;
        const recipeUpdates = updates.recipes || [];
        const totalToUpdate = recipeUpdates.length;
        
        console.log(`   Updating ${totalToUpdate} recipes...`);
        if (totalToUpdate > 10) {
          console.log(`   (Progress will be shown every ${Math.max(1, Math.floor(totalToUpdate / 20))} recipes)`);
        }
        console.log('');

        const updateStartTime = Date.now();
        const progressInterval = Math.max(1, Math.floor(totalToUpdate / 20)); // Show progress every 5%

        // Group updates by recipe and update all columns at once
        for (let updateIndex = 0; updateIndex < recipeUpdates.length; updateIndex++) {
          const recipeUpdate = recipeUpdates[updateIndex];
          
          // Show progress periodically
          if (updateIndex % progressInterval === 0 || updateIndex === 0 || updateIndex === totalToUpdate - 1) {
            const percent = Math.round((updateIndex / totalToUpdate) * 100);
            const elapsed = (Date.now() - updateStartTime) / 1000;
            const rate = elapsed > 0 ? updateIndex / elapsed : 0;
            const remaining = totalToUpdate - updateIndex;
            const eta = rate > 0 ? remaining / rate : 0;
            const etaMinutes = Math.floor(eta / 60);
            const etaSeconds = Math.floor(eta % 60);
            const rateDisplay = rate > 0 ? `${rate.toFixed(1)} updates/sec` : 'calculating...';
            const etaDisplay = rate > 0 ? `${etaMinutes}m ${etaSeconds}s` : 'calculating...';
            
            process.stdout.write(`   Progress: ${updateIndex}/${totalToUpdate} (${percent}%) | Speed: ${rateDisplay} | ETA: ${etaDisplay} | Recipe #${recipeUpdate.recipeId}\r`);
          }
          try {
            // Build UPDATE query with all columns that need updating
            const columnsToUpdate = [];
            const values = [];
            let paramIndex = 1;
            
            // Add category column updates
            for (const [categoryName, categoryData] of Object.entries(recipeUpdate.categories)) {
              columnsToUpdate.push(`${categoryData.dbColumn} = ${db.useMariaDB ? '?' : `$${paramIndex}`}`);
              values.push(categoryData.newValue);
              paramIndex++;
            }
            
            // Add type update if needed (set to "Drink" if drink ingredients found, or "Varmrätt" if any category is true)
            if (recipeUpdate.shouldSetDrink) {
              columnsToUpdate.push(`type = ${db.useMariaDB ? '?' : `$${paramIndex}`}`);
              values.push('Drink');
              paramIndex++;
            } else if (recipeUpdate.shouldSetVarmratt) {
              columnsToUpdate.push(`type = ${db.useMariaDB ? '?' : `$${paramIndex}`}`);
              values.push('Varmrätt');
              paramIndex++;
            }
            
            if (columnsToUpdate.length > 0) {
              const updateQuery = db.useMariaDB
                ? `UPDATE Name SET ${columnsToUpdate.join(', ')} WHERE id = ?;`
                : `UPDATE ${tableNameForQuery} SET ${columnsToUpdate.join(', ')} WHERE id = $${paramIndex};`;
              
              values.push(recipeUpdate.recipeId);
              
              await db.query(updateQuery, values);
              successCount++;
              
              if (VERBOSE) {
                const categoryList = Object.keys(recipeUpdate.categories || {}).map(cat => {
                  const emoji = cat === 'Fågel' ? '🐔' : cat === 'Kött' ? '🍖' : '🐟';
                  return `${emoji}${cat}`;
                }).join(', ');
                let typeUpdate = '';
                if (recipeUpdate.shouldSetDrink) {
                  typeUpdate = ', type → "Drink"';
                } else if (recipeUpdate.shouldSetVarmratt) {
                  typeUpdate = ', type → "Varmrätt"';
                }
                const categoryDisplay = categoryList ? ` [${categoryList}]` : '';
                console.log(`   ✅ Updated Recipe #${recipeUpdate.recipeId}: "${recipeUpdate.recipeName}"${categoryDisplay}${typeUpdate}`);
              }
            }
          } catch (error) {
            errorCount++;
            console.error(`\n   ❌ Error updating Recipe #${recipeUpdate.recipeId}: ${error.message}`);
          }
        }
        
        // Clear the progress line
        process.stdout.write('   ' + ' '.repeat(100) + '\r');
        const updateTotalTime = ((Date.now() - updateStartTime) / 1000).toFixed(1);
        const updateAvgRate = (totalToUpdate / (Date.now() - updateStartTime) * 1000).toFixed(1);

        console.log(`   ✅ Update complete! Processed ${totalToUpdate} recipes in ${updateTotalTime} seconds (${updateAvgRate} updates/sec)`);
        console.log(`   ✅ Update complete:`);
        console.log(`      - Successfully updated: ${successCount} recipes`);
        if (errorCount > 0) {
          console.log(`      - Errors: ${errorCount}`);
        }
      }
    } else {
      console.log('📋 Step 4: No updates needed');
    }

    console.log('');
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Recipe category population process completed!');
    console.log('='.repeat(60));
    console.log('');
    console.log('🎉 Script finished successfully. You can now close this window.');
    console.log('');

    // Summary statistics
    if (!DRY_RUN && totalUpdates > 0) {
      const finalCheckQueries = {
        fågel: db.useMariaDB
          ? `SELECT COUNT(*) as count FROM Name WHERE ${columnNames['Fågel']} = 1;`
          : `SELECT COUNT(*) as count FROM ${tableNameForQuery} WHERE ${columnNames['Fågel']} = true;`,
        kött: db.useMariaDB
          ? `SELECT COUNT(*) as count FROM Name WHERE ${columnNames['Kött']} = 1;`
          : `SELECT COUNT(*) as count FROM ${tableNameForQuery} WHERE ${columnNames['Kött']} = true;`,
        fisk: db.useMariaDB
          ? `SELECT COUNT(*) as count FROM Name WHERE ${columnNames['Fisk']} = 1;`
          : `SELECT COUNT(*) as count FROM ${tableNameForQuery} WHERE ${columnNames['Fisk']} = true;`
      };
      
      const fågelResult = await db.query(finalCheckQueries.fågel);
      const köttResult = await db.query(finalCheckQueries.kött);
      const fiskResult = await db.query(finalCheckQueries.fisk);
      
      const fågelCount = db.useMariaDB ? fågelResult.rows[0].count : fågelResult.rows[0].count;
      const köttCount = db.useMariaDB ? köttResult.rows[0].count : köttResult.rows[0].count;
      const fiskCount = db.useMariaDB ? fiskResult.rows[0].count : fiskResult.rows[0].count;
      
      console.log('');
      console.log('📊 Final Statistics:');
      console.log(`   - Total recipes: ${recipes.length}`);
      console.log(`   🐔 Recipes with Fågel (Poultry): ${fågelCount}`);
      console.log(`   🍖 Recipes with Kött (Meat): ${köttCount}`);
      console.log(`   🐟 Recipes with Fisk (Fish): ${fiskCount}`);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Error during category population:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // DatabaseService doesn't have a close method that works for both, so we'll just exit
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  populateCategories();
}

// Export both function names for backward compatibility
module.exports = { 
  populateCategories,
  populatePoultry: populateCategories, // Backward compatibility alias
  checkForPoultry, 
  checkForMeat,
  checkForFish,
  checkForDrink,
  analyzeRecipeForPoultry, 
  analyzeRecipeForCategories,
  POULTRY_KEYWORDS,
  MEAT_KEYWORDS,
  FISH_KEYWORDS,
  DRINK_KEYWORDS
};

