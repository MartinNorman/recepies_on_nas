# Fix Missing `recipe_id` Columns

The database tables `Ingredients`, `Instructions`, `CookingTimes`, and `Ratings` are missing the `recipe_id` column that links them to recipes in the `Name`/`Names` table.

## Problem

When trying to fetch recipe details, you get errors like:
```
Unknown column 'recipe_id' in 'where clause'
```

This happens because the tables were created without the `recipe_id` foreign key column.

## Solution

Add the `recipe_id` column to each table. Run these SQL commands in your database:

### For MariaDB/MySQL:

```sql
-- Add recipe_id to Ingredients table
ALTER TABLE Ingredients ADD COLUMN recipe_id INT;

-- Add recipe_id to Instructions table  
ALTER TABLE Instructions ADD COLUMN recipe_id INT;

-- Add recipe_id to CookingTimes table
ALTER TABLE CookingTimes ADD COLUMN recipe_id INT;

-- Add recipe_id to Ratings table
ALTER TABLE Ratings ADD COLUMN recipe_id INT;

-- Create indexes for better performance
CREATE INDEX idx_ingredients_recipe ON Ingredients(recipe_id);
CREATE INDEX idx_instructions_recipe ON Instructions(recipe_id);
CREATE INDEX idx_cookingtimes_recipe ON CookingTimes(recipe_id);
CREATE INDEX idx_ratings_recipe ON Ratings(recipe_id);
```

### For PostgreSQL:

```sql
-- Add recipe_id to Ingredients table
ALTER TABLE Ingredients ADD COLUMN recipe_id INTEGER;

-- Add recipe_id to Instructions table
ALTER TABLE Instructions ADD COLUMN recipe_id INTEGER;

-- Add recipe_id to CookingTimes table
ALTER TABLE CookingTimes ADD COLUMN recipe_id INTEGER;

-- Add recipe_id to Ratings table
ALTER TABLE Ratings ADD COLUMN recipe_id INTEGER;

-- Create indexes for better performance
CREATE INDEX idx_ingredients_recipe ON Ingredients(recipe_id);
CREATE INDEX idx_instructions_recipe ON Instructions(recipe_id);
CREATE INDEX idx_cookingtimes_recipe ON CookingTimes(recipe_id);
CREATE INDEX idx_ratings_recipe ON Ratings(recipe_id);
```

## How to Run

### Option 1: Using MySQL/MariaDB command line

```bash
mysql -u your_username -p your_database_name < add_recipe_id_columns.sql
```

Or connect interactively:
```bash
mysql -u your_username -p your_database_name
```
Then paste the SQL commands above.

### Option 2: Using phpMyAdmin or similar tool

1. Open phpMyAdmin or your database management tool
2. Select your database
3. Go to the SQL tab
4. Paste the SQL commands above
5. Click "Go" or "Execute"

### Option 3: Using Node.js script

You can create a script to run these commands programmatically. See the `scripts/` directory for examples.

## Important Notes

1. **Existing Data**: If you have existing data in these tables, the `recipe_id` values will be `NULL` after adding the column. You may need to populate them manually or write a migration script.

2. **Foreign Key Constraints**: The SQL above doesn't add foreign key constraints. If you want to enforce referential integrity, you can add them later:

```sql
-- For MariaDB/MySQL
ALTER TABLE Ingredients ADD CONSTRAINT fk_ingredients_recipe 
  FOREIGN KEY (recipe_id) REFERENCES Name(id) ON DELETE CASCADE;

ALTER TABLE Instructions ADD CONSTRAINT fk_instructions_recipe 
  FOREIGN KEY (recipe_id) REFERENCES Name(id) ON DELETE CASCADE;

ALTER TABLE CookingTimes ADD CONSTRAINT fk_cookingtimes_recipe 
  FOREIGN KEY (recipe_id) REFERENCES Name(id) ON DELETE CASCADE;

ALTER TABLE Ratings ADD CONSTRAINT fk_ratings_recipe 
  FOREIGN KEY (recipe_id) REFERENCES Name(id) ON DELETE CASCADE;
```

3. **Table Name**: The foreign key references `Name(id)`. If your table is called `Names` (plural), change `Name` to `Names` in the foreign key constraints above.

## After Running

After adding the columns, restart your server:
```bash
./synology/stop.sh
./synology/start.sh
```

Then try opening a recipe again - it should work!

