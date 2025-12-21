const { Pool } = require('pg');
const config = require('../config');

// Create database connection
const pool = new Pool(config.database);

async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Create CookingTimes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS CookingTimes (
        id SERIAL PRIMARY KEY,
        time INTEGER NOT NULL,
        timeunit VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Ingredients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Ingredients (
        id SERIAL PRIMARY KEY,
        amount DECIMAL(10,2),
        amount_type VARCHAR(50),
        ingredient VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Instructions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Instructions (
        id SERIAL PRIMARY KEY,
        instruction TEXT NOT NULL,
        step INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Names table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Names (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Ratings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Ratings (
        id SERIAL PRIMARY KEY,
        rating DECIMAL(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5),
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

    // Create indexes for new tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_weeklymenus_week_start ON WeeklyMenus(week_start_date);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_menuitems_menu_day ON MenuItems(menu_id, day_of_week);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shoppinglistitems_ingredient ON ShoppingListItems(ingredient);
    `);

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
