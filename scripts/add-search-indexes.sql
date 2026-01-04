-- Performance Optimization: Add indexes for faster searches
-- Run this script to improve search performance
-- 
-- IMPORTANT: 
-- - For PostgreSQL: Run as-is
-- - For MariaDB/MySQL: See alternative approach below for functional indexes

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
-- PRIORITY 2: Functional Indexes (PostgreSQL)
-- ============================================
-- These indexes enable fast case-insensitive searches

-- Functional index for case-insensitive ingredient search
CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient_lower 
ON Ingredients(LOWER(TRIM(ingredient)));

-- Functional index for case-insensitive name search
CREATE INDEX IF NOT EXISTS idx_names_name_lower 
ON Name(LOWER(name));

-- Functional index for case-insensitive type search
CREATE INDEX IF NOT EXISTS idx_names_type_lower 
ON Name(LOWER(type));

-- ============================================
-- ALTERNATIVE FOR MariaDB/MySQL
-- ============================================
-- MariaDB/MySQL doesn't support functional indexes directly
-- Use generated columns instead (MySQL 5.7.6+, MariaDB 10.2+)
--
-- Uncomment and run these if using MariaDB/MySQL:
--
-- ALTER TABLE Ingredients 
-- ADD COLUMN ingredient_lower VARCHAR(255) 
-- GENERATED ALWAYS AS (LOWER(TRIM(ingredient))) STORED;
--
-- CREATE INDEX idx_ingredients_ingredient_lower ON Ingredients(ingredient_lower);
--
-- ALTER TABLE Name 
-- ADD COLUMN name_lower VARCHAR(255) 
-- GENERATED ALWAYS AS (LOWER(name)) STORED;
--
-- CREATE INDEX idx_names_name_lower ON Name(name_lower);
--
-- ALTER TABLE Name 
-- ADD COLUMN type_lower VARCHAR(255) 
-- GENERATED ALWAYS AS (LOWER(type)) STORED;
--
-- CREATE INDEX idx_names_type_lower ON Name(type_lower);

-- ============================================
-- Verify Indexes
-- ============================================
-- Run these queries to verify indexes were created:

-- PostgreSQL:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('ingredients', 'name', 'cookingtimes', 'ratings');

-- MariaDB/MySQL:
-- SHOW INDEXES FROM Ingredients;
-- SHOW INDEXES FROM Name;
-- SHOW INDEXES FROM CookingTimes;
-- SHOW INDEXES FROM Ratings;

