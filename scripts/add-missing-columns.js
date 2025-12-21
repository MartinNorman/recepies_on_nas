const { Pool } = require('pg');
const config = require('../config');

async function addMissingColumns() {
  const pool = new Pool(config.database);
  
  try {
    console.log('Adding missing columns to ShoppingListItems...');
    
    // Add random_id column
    await pool.query(`
      ALTER TABLE ShoppingListItems 
      ADD COLUMN IF NOT EXISTS random_id VARCHAR(32) UNIQUE;
    `);
    
    // Add name column
    await pool.query(`
      ALTER TABLE ShoppingListItems 
      ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `);
    
    console.log('✅ Missing columns added successfully!');
    
    // Show the updated table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'shoppinglistitems' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Updated ShoppingListItems table structure:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding columns:', error);
  } finally {
    await pool.end();
  }
}

addMissingColumns();
