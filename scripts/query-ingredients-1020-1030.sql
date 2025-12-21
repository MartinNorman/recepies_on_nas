-- Query to list ingredients for recipes with IDs 1020-1030
-- This helps compare with the categorization results from populate-poultry.js

-- For PostgreSQL:
SELECT 
    n.id AS recipe_id,
    n.name AS recipe_name,
    n.type AS recipe_type,
    i.ingredient,
    i.amount,
    i.amount_type,
    i.id AS ingredient_id
FROM "Name" n
LEFT JOIN Ingredients i ON i.id = n.id
WHERE n.id >= 1020 AND n.id <= 1030
ORDER BY n.id, i.id;

-- Alternative query if Ingredients table uses recipe_id column instead:
-- SELECT 
--     n.id AS recipe_id,
--     n.name AS recipe_name,
--     n.type AS recipe_type,
--     i.ingredient,
--     i.amount,
--     i.amount_type,
--     i.id AS ingredient_id
-- FROM "Name" n
-- LEFT JOIN Ingredients i ON i.recipe_id = n.id
-- WHERE n.id >= 1020 AND n.id <= 1030
-- ORDER BY n.id, i.id;

-- For MariaDB/MySQL (uncomment if using MariaDB):
-- SELECT 
--     n.id AS recipe_id,
--     n.name AS recipe_name,
--     n.type AS recipe_type,
--     i.ingredient,
--     i.amount,
--     i.amount_type,
--     i.id AS ingredient_id
-- FROM Name n
-- LEFT JOIN Ingredients i ON i.id = n.id
-- WHERE n.id >= 1020 AND n.id <= 1030
-- ORDER BY n.id, i.id;

