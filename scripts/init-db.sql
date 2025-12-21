-- Initialize Recipe Database Schema

-- Create CookingTimes table
CREATE TABLE IF NOT EXISTS CookingTimes (
  id SERIAL PRIMARY KEY,
  time INTEGER NOT NULL,
  timeunit VARCHAR(50) NOT NULL,
  recipe_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Ingredients table
CREATE TABLE IF NOT EXISTS Ingredients (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(10,2),
  amount_type VARCHAR(50),
  ingredient VARCHAR(255) NOT NULL,
  recipe_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Instructions table
CREATE TABLE IF NOT EXISTS Instructions (
  id SERIAL PRIMARY KEY,
  instruction TEXT NOT NULL,
  step INTEGER NOT NULL,
  recipe_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Names table
CREATE TABLE IF NOT EXISTS Names (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  recipe_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Ratings table
CREATE TABLE IF NOT EXISTS Ratings (
  id SERIAL PRIMARY KEY,
  rating DECIMAL(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  recipe_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create WeeklyMenus table
CREATE TABLE IF NOT EXISTS WeeklyMenus (
  id SERIAL PRIMARY KEY,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  name VARCHAR(255),
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create MenuItems table
CREATE TABLE IF NOT EXISTS MenuItems (
  id SERIAL PRIMARY KEY,
  menu_id INTEGER NOT NULL REFERENCES WeeklyMenus(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  recipe_id INTEGER NOT NULL,
  meal_type VARCHAR(50) DEFAULT 'dinner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(menu_id, day_of_week, meal_type)
);

-- Create ShoppingLists table
CREATE TABLE IF NOT EXISTS ShoppingLists (
  id SERIAL PRIMARY KEY,
  menu_id INTEGER REFERENCES WeeklyMenus(id) ON DELETE CASCADE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ShoppingListItems table
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
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cookingtimes_time ON CookingTimes(time);
CREATE INDEX IF NOT EXISTS idx_cookingtimes_recipe ON CookingTimes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient ON Ingredients(ingredient);
CREATE INDEX IF NOT EXISTS idx_ingredients_amount_type ON Ingredients(amount_type);
CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON Ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_instructions_step ON Instructions(step);
CREATE INDEX IF NOT EXISTS idx_instructions_recipe ON Instructions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_names_name ON Names(name);
CREATE INDEX IF NOT EXISTS idx_names_type ON Names(type);
CREATE INDEX IF NOT EXISTS idx_names_recipe ON Names(recipe_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON Ratings(rating);
CREATE INDEX IF NOT EXISTS idx_ratings_recipe ON Ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_weeklymenus_week_start ON WeeklyMenus(week_start_date);
CREATE INDEX IF NOT EXISTS idx_menuitems_menu_day ON MenuItems(menu_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_shoppinglistitems_ingredient ON ShoppingListItems(ingredient);
CREATE INDEX IF NOT EXISTS idx_shoppinglistitems_random_id ON ShoppingListItems(random_id);
