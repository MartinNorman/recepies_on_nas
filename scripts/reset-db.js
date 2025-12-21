const { Pool } = require('pg');  
const config = require('../config');

const pool = new Pool(config.database);

async function resetDatabase() {
  try {
    console.log('Resetting database...');

    // Drop existing tables in correct order (respecting foreign key constraints)
    console.log('Dropping existing tables...');
    
    try {
      // New menu/shopping related tables first
      await pool.query('DROP TABLE IF EXISTS ShoppingListItems CASCADE');
      await pool.query('DROP TABLE IF EXISTS ShoppingLists CASCADE');
      await pool.query('DROP TABLE IF EXISTS MenuItems CASCADE');
      await pool.query('DROP TABLE IF EXISTS WeeklyMenus CASCADE');

      await pool.query('DROP TABLE IF EXISTS recipe_ingredients CASCADE');
      await pool.query('DROP TABLE IF EXISTS Ingredients CASCADE');
      await pool.query('DROP TABLE IF EXISTS ingredients CASCADE'); 
      await pool.query('DROP TABLE IF EXISTS recipes CASCADE');
      await pool.query('DROP TABLE IF EXISTS CookingTimes CASCADE');
      await pool.query('DROP TABLE IF EXISTS Instructions CASCADE');
      await pool.query('DROP TABLE IF EXISTS Names CASCADE');
      await pool.query('DROP TABLE IF EXISTS Ratings CASCADE');
      
      console.log('Old tables dropped successfully');
    } catch (dropError) {
      console.log('Note: Some tables may not have existed:', dropError.message);
    }

    // Now create your new tables
    console.log('Creating new tables...');

    // Create CookingTimes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS CookingTimes (
        id INTEGER PRIMARY KEY,
        time INTEGER NOT NULL,
        timeunit VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Ingredients table with recipe relationship
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Ingredients (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER NOT NULL,
        amount DECIMAL(10,2),
        amount_type VARCHAR(50),
        ingredient VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Instructions table with recipe relationship
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Instructions (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        step INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Names table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Names (
        recepie_id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Ratings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Ratings (
        recepie_id INTEGER PRIMARY KEY,
        rating DECIMAL(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create WeeklyMenus table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS WeeklyMenus (
        id SERIAL PRIMARY KEY,
        week_start_date DATE NOT NULL,
        week_end_date DATE NOT NULL,
        name VARCHAR(255),
        active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create MenuItems table (recipes assigned to specific days)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS MenuItems (
        id SERIAL PRIMARY KEY,
        menu_id INTEGER NOT NULL REFERENCES WeeklyMenus(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        recipe_id INTEGER NOT NULL,
        meal_type VARCHAR(50) DEFAULT 'dinner',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(menu_id, day_of_week, meal_type)
      )
    `);

    // Create ShoppingLists table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ShoppingLists (
        id SERIAL PRIMARY KEY,
        menu_id INTEGER NOT NULL REFERENCES WeeklyMenus(id) ON DELETE CASCADE,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create ShoppingListItems table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ShoppingListItems (
        id SERIAL PRIMARY KEY,
        shopping_list_id INTEGER NOT NULL REFERENCES ShoppingLists(id) ON DELETE CASCADE,
        ingredient VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10,2),
        amount_type VARCHAR(50),
        is_purchased BOOLEAN DEFAULT FALSE,
        random_id VARCHAR(32) UNIQUE,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better search performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cookingtimes_time ON CookingTimes(time);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient ON Ingredients(ingredient);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ingredients_amount_type ON Ingredients(amount_type);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_instructions_step ON Instructions(step);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_names_name ON Names(name);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_names_type ON Names(type);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ratings_rating ON Ratings(rating);
    `);

    // Indexes for new tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_weeklymenus_week_start ON WeeklyMenus(week_start_date);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_menuitems_menu_day ON MenuItems(menu_id, day_of_week);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shoppinglistitems_ingredient ON ShoppingListItems(ingredient);
    `);

    console.log('New tables created successfully!');
    console.log('Tables created:');
    console.log('- CookingTimes (id, time, timeunit)');
    console.log('- Ingredients (id, recipe_id, amount, amount_type, ingredient)');
    console.log('- Instructions (id, recipe_id, instruction, step)');
    console.log('- Names (recepie_id, name, type)');
    console.log('- Ratings (recepie_id, rating)');
    console.log('- WeeklyMenus (id, week_start_date, week_end_date, name)');
    console.log('- MenuItems (id, menu_id, day_of_week, recipe_id, meal_type)');
    console.log('- ShoppingLists (id, menu_id, name)');
    console.log('- ShoppingListItems (id, shopping_list_id, ingredient, total_amount, amount_type, is_purchased)');

  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    await pool.end();
  }
}

resetDatabase();
