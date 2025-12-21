-- Initialize Recipe Database Schema for MariaDB

-- Create CookingTimes table
CREATE TABLE IF NOT EXISTS CookingTimes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  time INT NOT NULL,
  timeunit VARCHAR(50) NOT NULL,
  recipe_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Ingredients table
CREATE TABLE IF NOT EXISTS Ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount DECIMAL(10,2),
  amount_type VARCHAR(50),
  ingredient VARCHAR(255) NOT NULL,
  recipe_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Instructions table
CREATE TABLE IF NOT EXISTS Instructions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instruction TEXT NOT NULL,
  step INT NOT NULL,
  recipe_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Names table
CREATE TABLE IF NOT EXISTS Names (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100)
);

-- Create Ratings table
CREATE TABLE IF NOT EXISTS Ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rating DECIMAL(3,2) NOT NULL,
  recipe_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (rating >= 0 AND rating <= 5)
);

-- Create WeeklyMenus table
CREATE TABLE IF NOT EXISTS WeeklyMenus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  name VARCHAR(255),
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create MenuItems table
CREATE TABLE IF NOT EXISTS MenuItems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  day_of_week INT NOT NULL,
  recipe_id INT NOT NULL,
  meal_type VARCHAR(50) DEFAULT 'dinner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_menu_day_meal (menu_id, day_of_week, meal_type),
  CONSTRAINT fk_menuitems_menu FOREIGN KEY (menu_id) REFERENCES WeeklyMenus(id) ON DELETE CASCADE,
  CHECK (day_of_week >= 0 AND day_of_week <= 6)
);

-- Create ShoppingLists table
CREATE TABLE IF NOT EXISTS ShoppingLists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shoppinglists_menu FOREIGN KEY (menu_id) REFERENCES WeeklyMenus(id) ON DELETE CASCADE
);

-- Create ShoppingListItems table
CREATE TABLE IF NOT EXISTS ShoppingListItems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shopping_list_id INT NOT NULL,
  ingredient VARCHAR(255) NOT NULL,
  total_amount DECIMAL(10,2),
  amount_type VARCHAR(50),
  is_purchased BOOLEAN DEFAULT FALSE,
  random_id VARCHAR(32) UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shoppinglistitems_list FOREIGN KEY (shopping_list_id) REFERENCES ShoppingLists(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_cookingtimes_time ON CookingTimes(time);
CREATE INDEX idx_cookingtimes_recipe ON CookingTimes(recipe_id);
CREATE INDEX idx_ingredients_ingredient ON Ingredients(ingredient);
CREATE INDEX idx_ingredients_amount_type ON Ingredients(amount_type);
CREATE INDEX idx_ingredients_recipe ON Ingredients(recipe_id);
CREATE INDEX idx_instructions_step ON Instructions(step);
CREATE INDEX idx_instructions_recipe ON Instructions(recipe_id);
CREATE INDEX idx_names_name ON Names(name);
CREATE INDEX idx_names_type ON Names(type);
CREATE INDEX idx_names_recipe ON Names(recipe_id);
CREATE INDEX idx_ratings_rating ON Ratings(rating);
CREATE INDEX idx_ratings_recipe ON Ratings(recipe_id);
CREATE INDEX idx_weeklymenus_week_start ON WeeklyMenus(week_start_date);
CREATE INDEX idx_menuitems_menu_day ON MenuItems(menu_id, day_of_week);
CREATE INDEX idx_shoppinglistitems_ingredient ON ShoppingListItems(ingredient);
CREATE INDEX idx_shoppinglistitems_random_id ON ShoppingListItems(random_id);
