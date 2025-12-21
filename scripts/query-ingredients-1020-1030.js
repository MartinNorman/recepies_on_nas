// Script to query and display ingredients for recipes 1020-1030
// Run with: node scripts/query-ingredients-1020-1030.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const DatabaseService = require('../services/database');
const config = require('../config');

async function queryIngredients() {
  const db = new DatabaseService();
  
  try {
    console.log('Querying ingredients for recipes 1020-1030...\n');
    
    // Try both id and recipe_id as the linking field
    let query, result;
    
    // First try with id = recipe id (as used in populate-poultry.js)
    try {
      query = db.useMariaDB
        ? `SELECT 
            n.id AS recipe_id,
            n.name AS recipe_name,
            n.type AS recipe_type,
            i.ingredient,
            i.amount,
            i.amount_type,
            i.id AS ingredient_id
          FROM Name n
          LEFT JOIN Ingredients i ON i.id = n.id
          WHERE n.id >= ? AND n.id <= ?
          ORDER BY n.id, i.id`
        : `SELECT 
            n.id AS recipe_id,
            n.name AS recipe_name,
            n.type AS recipe_type,
            i.ingredient,
            i.amount,
            i.amount_type,
            i.id AS ingredient_id
          FROM "Name" n
          LEFT JOIN Ingredients i ON i.id = n.id
          WHERE n.id >= $1 AND n.id <= $2
          ORDER BY n.id, i.id`;
      
      result = await db.query(query, [1020, 1030]);
    } catch (error) {
      // If that fails, try with recipe_id
      console.log('Trying with recipe_id column...');
      query = db.useMariaDB
        ? `SELECT 
            n.id AS recipe_id,
            n.name AS recipe_name,
            n.type AS recipe_type,
            i.ingredient,
            i.amount,
            i.amount_type,
            i.id AS ingredient_id
          FROM Name n
          LEFT JOIN Ingredients i ON i.recipe_id = n.id
          WHERE n.id >= ? AND n.id <= ?
          ORDER BY n.id, i.id`
        : `SELECT 
            n.id AS recipe_id,
            n.name AS recipe_name,
            n.type AS recipe_type,
            i.ingredient,
            i.amount,
            i.amount_type,
            i.id AS ingredient_id
          FROM "Name" n
          LEFT JOIN Ingredients i ON i.recipe_id = n.id
          WHERE n.id >= $1 AND n.id <= $2
          ORDER BY n.id, i.id`;
      
      result = await db.query(query, [1020, 1030]);
    }
    
    const rows = result.rows;
    
    if (rows.length === 0) {
      console.log('No recipes found in range 1020-1030');
      return;
    }
    
    // Group by recipe
    const recipes = {};
    rows.forEach(row => {
      const recipeId = row.recipe_id;
      if (!recipes[recipeId]) {
        recipes[recipeId] = {
          id: recipeId,
          name: row.recipe_name,
          type: row.recipe_type,
          ingredients: []
        };
      }
      if (row.ingredient) {
        recipes[recipeId].ingredients.push({
          ingredient: row.ingredient,
          amount: row.amount,
          amount_type: row.amount_type
        });
      }
    });
    
    // Display results
    console.log('='.repeat(80));
    console.log(`Found ${Object.keys(recipes).length} recipes with ingredients:\n`);
    
    Object.values(recipes).forEach(recipe => {
      console.log(`Recipe ID: ${recipe.id}`);
      console.log(`Name: ${recipe.name}`);
      console.log(`Type: ${recipe.type || '(not set)'}`);
      console.log(`Ingredients (${recipe.ingredients.length}):`);
      
      if (recipe.ingredients.length === 0) {
        console.log('  (no ingredients found)');
      } else {
        recipe.ingredients.forEach((ing, idx) => {
          const amountStr = ing.amount ? `${ing.amount} ${ing.amount_type || ''}`.trim() : '';
          console.log(`  ${idx + 1}. ${amountStr ? amountStr + ' ' : ''}${ing.ingredient}`);
        });
      }
      
      console.log('-'.repeat(80));
    });
    
    console.log('\n✅ Query complete!');
    
  } catch (error) {
    console.error('❌ Error querying ingredients:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the query
if (require.main === module) {
  queryIngredients();
}

module.exports = { queryIngredients };

