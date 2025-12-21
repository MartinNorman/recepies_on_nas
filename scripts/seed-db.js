const { Pool } = require('pg');  
const config = require('../config');

const pool = new Pool(config.database);

// Sample data for the new table structure
const sampleCookingTimes = [
  { time: 20, timeunit: 'minutes' },
  { time: 15, timeunit: 'minutes' },
  { time: 30, timeunit: 'minutes' },
  { time: 10, timeunit: 'minutes' },
  { time: 45, timeunit: 'minutes' },
  { time: 25, timeunit: 'minutes' }
];

const sampleIngredients = [
  { amount: 1.0, amount_type: 'cup', ingredient: 'flour' },
  { amount: 0.5, amount_type: 'cup', ingredient: 'sugar' },
  { amount: 2.0, amount_type: 'cups', ingredient: 'milk' },
  { amount: 3.0, amount_type: 'tbsp', ingredient: 'oil' },
  { amount: 1.0, amount_type: 'large', ingredient: 'eggs' },
  { amount: 250.0, amount_type: 'grams', ingredient: 'cheese' },
  { amount: 500.0, amount_type: 'grams', ingredient: 'chicken' },
  { amount: 1.0, amount_type: 'tsp', ingredient: 'salt' },
  { amount: 0.5, amount_type: 'tsp', ingredient: 'pepper' },
  { amount: 2.0, amount_type: 'cups', ingredient: 'vegetables' }
];

const sampleInstructions = [
  { instruction: 'Preheat oven to 180°C (350°F)', step: 1 },
  { instruction: 'Mix dry ingredients in a large bowl', step: 2 },
  { instruction: 'Add wet ingredients and mix until combined', step: 3 },
  { instruction: 'Pour batter into prepared pan', step: 4 },
  { instruction: 'Bake for 25-30 minutes until golden', step: 5 },
  { instruction: 'Let cool before serving', step: 6 },
  { instruction: 'Heat oil in a large pan', step: 1 },
  { instruction: 'Add ingredients and cook until tender', step: 2 },
  { instruction: 'Season with salt and pepper', step: 3 },
  { instruction: 'Serve hot', step: 4 }
];

const sampleNames = [
  { name: 'Chocolate Cake', type: 'dessert' },
  { name: 'Spaghetti Carbonara', type: 'main course' },
  { name: 'Caesar Salad', type: 'appetizer' },
  { name: 'Grilled Chicken', type: 'main course' },
  { name: 'Vegetable Soup', type: 'appetizer' },
  { name: 'Apple Pie', type: 'dessert' },
  { name: 'Garlic Bread', type: 'side dish' },
  { name: 'Fruit Salad', type: 'dessert' }
];

const sampleRatings = [
  { rating: 4.5 },
  { rating: 4.8 },
  { rating: 3.9 },
  { rating: 4.2 },
  { rating: 4.6 },
  { rating: 3.7 },
  { rating: 4.4 },
  { rating: 4.1 }
];

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Clear existing data
    await pool.query('DELETE FROM CookingTimes');
    await pool.query('DELETE FROM Ingredients');
    await pool.query('DELETE FROM Instructions');
    await pool.query('DELETE FROM Names');
    await pool.query('DELETE FROM Ratings');
    
    // Reset sequences
    await pool.query('ALTER SEQUENCE "CookingTimes_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Ingredients_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Instructions_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Names_id_seq" RESTART WITH 1');
    await pool.query('ALTER SEQUENCE "Ratings_id_seq" RESTART WITH 1');
    
    // Insert CookingTimes data
    for (const cookingTime of sampleCookingTimes) {
      await pool.query(`
        INSERT INTO CookingTimes (time, timeunit)
        VALUES ($1, $2)
      `, [cookingTime.time, cookingTime.timeunit]);
    }
    console.log(`Inserted ${sampleCookingTimes.length} cooking times`);
    
    // Insert Ingredients data
    for (const ingredient of sampleIngredients) {
      await pool.query(`
        INSERT INTO Ingredients (amount, amount_type, ingredient)
        VALUES ($1, $2, $3)
      `, [ingredient.amount, ingredient.amount_type, ingredient.ingredient]);
    }
    console.log(`Inserted ${sampleIngredients.length} ingredients`);
    
    // Insert Instructions data
    for (const instruction of sampleInstructions) {
      await pool.query(`
        INSERT INTO Instructions (instruction, step)
        VALUES ($1, $2)
      `, [instruction.instruction, instruction.step]);
    }
    console.log(`Inserted ${sampleInstructions.length} instructions`);
    
    // Insert Names data
    for (const name of sampleNames) {
      await pool.query(`
        INSERT INTO Names (name, type)
        VALUES ($1, $2)
      `, [name.name, name.type]);
    }
    console.log(`Inserted ${sampleNames.length} names`);
    
    // Insert Ratings data
    for (const rating of sampleRatings) {
      await pool.query(`
        INSERT INTO Ratings (rating)
        VALUES ($1)
      `, [rating.rating]);
    }
    console.log(`Inserted ${sampleRatings.length} ratings`);
    
    console.log('Database seeding completed successfully!');
    
    // Display summary
    const cookingTimesCount = await pool.query('SELECT COUNT(*) FROM CookingTimes');
    const ingredientsCount = await pool.query('SELECT COUNT(*) FROM Ingredients');
    const instructionsCount = await pool.query('SELECT COUNT(*) FROM Instructions');
    const namesCount = await pool.query('SELECT COUNT(*) FROM Names');
    const ratingsCount = await pool.query('SELECT COUNT(*) FROM Ratings');
    
    console.log(`Summary:`);
    console.log(`- CookingTimes: ${cookingTimesCount.rows[0].count}`);
    console.log(`- Ingredients: ${ingredientsCount.rows[0].count}`);
    console.log(`- Instructions: ${instructionsCount.rows[0].count}`);
    console.log(`- Names: ${namesCount.rows[0].count}`);
    console.log(`- Ratings: ${ratingsCount.rows[0].count}`);
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await pool.end();
  }
}

seedDatabase();
