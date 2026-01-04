-- Performance Optimization: Add indexes for faster searches (MariaDB/MySQL)
-- Run this script to improve search performance for MariaDB/MySQL databases
-- 
-- Requirements: MySQL 5.7.6+ or MariaDB 10.2+ (for generated columns)

-- ============================================
-- PRIORITY 1: Missing Basic Indexes
-- ============================================

-- Index on Ingredients.id for faster joins (critical for ingredient search)
CREATE INDEX IF NOT EXISTS idx_ingredients_id ON Ingredients(id);

-- Index on CookingTimes.id for faster joins
CREATE INDEX IF NOT EXISTS idx_cookingtimes_id ON CookingTimes(id);

-- Index on Ratings.id for faster joins
CREATE INDEX IF NOT EXISTS idx_ratings_id ON Ratings(id);

-- ============================================
-- PRIORITY 2: Generated Columns for Case-Insensitive Searches
-- ============================================
-- MariaDB/MySQL doesn't support functional indexes directly
-- Use generated columns instead

-- Add generated column for case-insensitive ingredient search
-- Check if column already exists before adding
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'Ingredients' 
  AND COLUMN_NAME = 'ingredient_lower';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE Ingredients ADD COLUMN ingredient_lower VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(ingredient))) STORED',
    'SELECT "Column ingredient_lower already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient_lower ON Ingredients(ingredient_lower);

-- Add generated column for case-insensitive name search
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'Name' 
  AND COLUMN_NAME = 'name_lower';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE Name ADD COLUMN name_lower VARCHAR(255) GENERATED ALWAYS AS (LOWER(name)) STORED',
    'SELECT "Column name_lower already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_names_name_lower ON Name(name_lower);

-- Add generated column for case-insensitive type search
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'Name' 
  AND COLUMN_NAME = 'type_lower';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE Name ADD COLUMN type_lower VARCHAR(255) GENERATED ALWAYS AS (LOWER(type)) STORED',
    'SELECT "Column type_lower already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE INDEX IF NOT EXISTS idx_names_type_lower ON Name(type_lower);

-- ============================================
-- Verify Indexes
-- ============================================
-- Run these queries to verify indexes were created:
-- SHOW INDEXES FROM Ingredients;
-- SHOW INDEXES FROM Name;
-- SHOW INDEXES FROM CookingTimes;
-- SHOW INDEXES FROM Ratings;

