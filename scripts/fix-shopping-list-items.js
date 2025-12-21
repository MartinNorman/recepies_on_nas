const { Pool } = require('pg');
const config = require('../config');

async function fixShoppingListItems() {
  const pool = new Pool(config.database);
  
  try {
    console.log('Fixing shopping list items with random IDs...');
    
    // Get all shopping list items without random_id
    const result = await pool.query(`
      SELECT id FROM ShoppingListItems 
      WHERE random_id IS NULL;
    `);
    
    console.log(`Found ${result.rows.length} items without random_id`);
    
    // Generate random 32-character ID for each item
    const generateRandomId = () => {
      const chars = '0123456789abcdef';
      let randomId = '';
      for (let i = 0; i < 32; i++) {
        randomId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return randomId;
    };
    
    // Update each item with a random ID
    for (const item of result.rows) {
      const randomId = generateRandomId();
      await pool.query(`
        UPDATE ShoppingListItems 
        SET random_id = $1, 
            name = CONCAT(ingredient, ' ', total_amount, ' ', COALESCE(amount_type, ''))
        WHERE id = $2;
      `, [randomId, item.id]);
      
      console.log(`Updated item ${item.id} with random_id: ${randomId}`);
    }
    
    console.log('✅ All shopping list items updated with random IDs!');
    
  } catch (error) {
    console.error('❌ Error fixing shopping list items:', error);
  } finally {
    await pool.end();
  }
}

fixShoppingListItems();

