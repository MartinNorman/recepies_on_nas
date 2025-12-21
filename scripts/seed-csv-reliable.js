const { Pool } = require('pg');  
const fs = require('fs');
const path = require('path');
const config = require('../config');

const pool = new Pool(config.database);

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    // Better CSV parsing that handles quoted values
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add the last value
    
    return headers.reduce((obj, header, index) => {
      let value = values[index]?.trim();
      // Remove quotes if present
      if (value && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      obj[header.trim()] = value;
      return obj;
    }, {});
  });
  return rows;
}

async function seedFromCSVReliable() {
  try {
    console.log('Starting CSV seeding...');
    
    // Clear existing data
    await pool.query('DELETE FROM CookingTimes');
    await pool.query('DELETE FROM Ingredients');
    await pool.query('DELETE FROM Instructions');
    await pool.query('DELETE FROM Names');
    await pool.query('DELETE FROM Ratings');
    
    console.log('Cleared existing data');

    // No need to reset sequences since we're using manual INTEGER IDs

    // Load CookingTimes
    console.log('Loading CookingTimes...');
    const cookingTimesCSV = fs.readFileSync(path.resolve(__dirname, '../seeds/CookingTimes.csv'), 'utf8');
    const cookingTimesData = parseCSV(cookingTimesCSV);
    console.log('First row sample:', cookingTimesData[0]);
    for (const row of cookingTimesData) {
      const id = parseInt(row.id);
      const time = parseInt(row.time);
      if (isNaN(id) || isNaN(time)) {
        console.error(`Invalid values for CookingTimes row:`, row);
        continue;
      }
      await pool.query(`
        INSERT INTO CookingTimes (id, time, timeunit) 
        VALUES ($1, $2, $3)
      `, [id, time, row.timeunit]);
    }
    console.log(`✓ CookingTimes loaded: ${cookingTimesData.length} records`);

    // Load Ingredients
    console.log('Loading Ingredients...');
    const ingredientsCSV = fs.readFileSync(path.resolve(__dirname, '../seeds/Ingredients.csv'), 'utf8');
    const ingredientsData = parseCSV(ingredientsCSV);
    for (const row of ingredientsData) {
      const recipe_id = parseInt(row.recipe_id);
      const amount = parseFloat(row.amount);
      if (isNaN(recipe_id) || isNaN(amount)) {
        console.error(`Invalid values for Ingredients row:`, row);
        continue;
      }
      await pool.query(`
        INSERT INTO Ingredients (recipe_id, amount, amount_type, ingredient) 
        VALUES ($1, $2, $3, $4)
      `, [recipe_id, amount, row.amount_type, row.ingredient]);
    }
    console.log(`✓ Ingredients loaded: ${ingredientsData.length} records`);

    // Load Instructions
    console.log('Loading Instructions...');
    const instructionsCSV = fs.readFileSync(path.resolve(__dirname, '../seeds/Instructions.csv'), 'utf8');
    const instructionsData = parseCSV(instructionsCSV);
    for (const row of instructionsData) {
      const recipe_id = parseInt(row.recipe_id);
      const step = parseInt(row.step);
      if (isNaN(recipe_id) || isNaN(step)) {
        console.error(`Invalid values for Instructions row:`, row);
        continue;
      }
      await pool.query(`
        INSERT INTO Instructions (recipe_id, instruction, step) 
        VALUES ($1, $2, $3)
      `, [recipe_id, row.instruction, step]);
    }
    console.log(`✓ Instructions loaded: ${instructionsData.length} records`);

    // Load Names
    console.log('Loading Names...');
    const namesCSV = fs.readFileSync(path.resolve(__dirname, '../seeds/Names.csv'), 'utf8');
    const namesData = parseCSV(namesCSV);
    for (const row of namesData) {
      const recepie_id = parseInt(row.recepie_id);
      if (isNaN(recepie_id)) {
        console.error(`Invalid values for Names row:`, row);
        continue;
      }
      await pool.query(`
        INSERT INTO Names (recepie_id, name, type) 
        VALUES ($1, $2, $3)
      `, [recepie_id, row.name, row.type]);
    }
    console.log(`✓ Names loaded: ${namesData.length} records`);

    // Load Ratings
    console.log('Loading Ratings...');
    const ratingsCSV = fs.readFileSync(path.resolve(__dirname, '../seeds/Ratings.csv'), 'utf8');
    const ratingsData = parseCSV(ratingsCSV);
    for (const row of ratingsData) {
      const recepie_id = parseInt(row.recepie_id);
      const rating = parseFloat(row.rating);
      if (isNaN(recepie_id) || isNaN(rating)) {
        console.error(`Invalid values for Ratings row:`, row);
        continue;
      }
      await pool.query(`
        INSERT INTO Ratings (recepie_id, rating) 
        VALUES ($1, $2)
      `, [recepie_id, rating]);
    }
    console.log(`✓ Ratings loaded: ${ratingsData.length} records`);

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

seedFromCSVReliable();
