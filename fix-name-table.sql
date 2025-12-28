-- Fix Name table structure for MariaDB/MySQL
-- This script fixes the AUTO_INCREMENT issue

-- Step 1: Check current structure
-- Run this first to see the current state:
-- SHOW CREATE TABLE Name;
-- DESCRIBE Name;

-- Step 2: Remove AUTO_INCREMENT if it exists but id is not a key
-- First, remove AUTO_INCREMENT from id (if it exists)
ALTER TABLE Name MODIFY id INT NOT NULL;

-- Step 3: Make id the PRIMARY KEY with AUTO_INCREMENT
ALTER TABLE Name MODIFY id INT AUTO_INCREMENT PRIMARY KEY;

-- Alternative if the above doesn't work (if there's already a primary key):
-- First drop the existing primary key if it's on a different column
-- ALTER TABLE Name DROP PRIMARY KEY;
-- Then add it to id
-- ALTER TABLE Name MODIFY id INT AUTO_INCREMENT PRIMARY KEY;

-- If you're using the 'Names' table instead of 'Name', replace Name with Names above

