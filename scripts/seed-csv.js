const { Pool } = require('pg');  
const fs = require('fs');
const path = require('path');
const config = require('../config');

const pool = new Pool(config.database);

async function seedFromCSV() {
  try {
    console.log('Starting CSV seeding...');
    
    // Clear existing data
    await pool.query('DELETE FROM CookingTimes');
    await pool.query('DELETE FROM Ingredients');
    await pool.query('DELETE FROM Instructions');
    await pool.query('DELETE FROM Names');
    await pool.query('DELETE FROM Ratings');
    
    console.log('Cleared existing data');

    // Reset sequences
    await pool.query('ALTER SEQUENCE "CookingTimes_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Ingredients_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Instructions_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Names_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Ratings_id_seq" RESTART WITH 1');
    
    console.log('Reset sequences');

    // Load CookingTimes
    console.log('Loading CookingTimes...');
    await pool.query(`
      COPY CookingTimes (time, timeunit) 
      FROM '${path.resolve(__dirname, '../seeds/CookingTimes.csv')}' 
      WITH CSV HEADER;
    `);
    console.log('✓ CookingTimes loaded');

    // Load Ingredients
    console.log('Loading Ingredients...');
    await pool.query(`
      COPY Ingredients (amount, amount_type, ingredient) 
      FROM '${path.resolve(__dirname, '../seeds/Ingredients.csv')}' 
      WITH CSV HEADER;
    `);
    console.log('✓ Ingredients loaded');

    // Load Instructions
    console.log('Loading Instructions...');
    await pool.query(`
      COPY Instructions (instruction, step) 
      FROM '${path.resolve(__dirname, '../seeds/Instructions.csv')}' 
      WITH CSV HEADER;
    `);
    console.log('✓ Instructions loaded');

    // Load Names
    console.log('Loading Names...');
    await pool.query(`
      COPY Names (name, type) 
      FROM '${path.resolve(__dirname, '../seeds/Names.csv')}' 
      WITH CSV HEADER;
    `);
    console.log('✓ Names loaded');

    // Load Ratings
    console.log('Loading Ratings...');
    await pool.query(`
      COPY Ratings (rating) 
      FROM '${path.resolve(__dirname, '../seeds/Ratings.csv')}' 
      WITH CSV HEADER;
    `);
    console.log('✓ Ratings loaded');

    console.log('\n🎉 All CSV files loaded successfully!');
    
    // Display summary
    const summary = await pool.query(`
      SELECT 
        'CookingTimes' as table_name, COUNT(*) as count FROM CookingTimes
      UNION ALL
      SELECT 'Ingredients', COUNT(*) FROM Ingredients
      UNION ALL  
      SELECT 'Instructions', COUNT(*) FROM Instructions
      UNION ALL
      SELECT 'Names', COUNT(*) FROM Names
      UNION ALL
      SELECT 'Ratings', COUNT(*) FROM Ratings
    `);
    
    console.log('\n📊 Data Summary:');
    summary.rows.forEach(row => {
      console.log(`- ${row.table_name}: ${row.count} records`);
    });

    console.log('\n🍰 Recipes loaded:');
    console.log('1. Chocolate Cake (4.5⭐)');
    console.log('2. Chocolate Chip Cookies (4.8⭐)');
    console.log('3. Banana Nut Bread (4.2⭐)');
    console.log('4. Apple Crisp (4.6⭐)');
    console.log('5. Yogurt Parfait (4.3⭐)');
    
  } catch (error) {
    console.error('Error seeding from CSV:', error);
  } finally {
    await pool.end();
  }
}

seedFromCSV();



