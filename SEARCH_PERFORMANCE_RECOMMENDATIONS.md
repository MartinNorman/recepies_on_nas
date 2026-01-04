# Search Performance Recommendations

This document outlines performance optimizations for the recipe search functionality.

## Current Performance Issues

### 1. **Ingredient Search (`/api/search/by-ingredients`)**

**Issues:**
- Uses `LOWER(TRIM(ingredient)) LIKE` which prevents index usage
- Multiple EXISTS subqueries (one per ingredient) can be slow with many ingredients
- Missing index on `Ingredients.id` for joins
- No functional index for case-insensitive searches

**Current Query Pattern:**
```sql
WHERE EXISTS (SELECT 1 FROM Ingredients i WHERE i.id = n.id 
              AND LOWER(TRIM(i.ingredient)) LIKE '%ingredient%')
```

### 2. **Quick Search (`/api/search/recipes`)**

**Issues:**
- Uses `LOWER(name) LIKE` which prevents index usage
- N+1 query problem: Fetches ingredients, cooking times, and ratings in a loop
- Missing functional index for case-insensitive name searches

**Current Query Pattern:**
```sql
WHERE LOWER(name) LIKE LOWER('%search%') OR LOWER(type) LIKE LOWER('%search%')
```

### 3. **Browse Recipes (`/api/tables/names`)**

**Issues:**
- N+1 query problem: Fetches cooking times and ratings in a loop for each recipe
- Could be optimized with batch queries

### 4. **Ingredient Suggestions (`/api/search/suggestions`)**

**Issues:**
- Uses `LOWER(ingredient) LIKE` which prevents index usage
- Limited to 10 results (acceptable, but could use better indexing)

## Recommended Optimizations

### Priority 1: Database Indexes (High Impact, Low Risk)

#### 1.1 Add Missing Indexes

```sql
-- Index on Ingredients.id for faster joins (critical for ingredient search)
CREATE INDEX IF NOT EXISTS idx_ingredients_id ON Ingredients(id);

-- Index on CookingTimes.id for faster joins
CREATE INDEX IF NOT EXISTS idx_cookingtimes_id ON CookingTimes(id);

-- Index on Ratings.id for faster joins
CREATE INDEX IF NOT EXISTS idx_ratings_id ON Ratings(id);

-- Composite index for ingredient search (if using recipe_id instead of id)
-- Check your schema - if Ingredients table uses recipe_id, add:
-- CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON Ingredients(recipe_id);
```

#### 1.2 Functional Indexes for Case-Insensitive Searches

**For PostgreSQL:**
```sql
-- Functional index for case-insensitive ingredient search
CREATE INDEX IF NOT EXISTS idx_ingredients_ingredient_lower 
ON Ingredients(LOWER(TRIM(ingredient)));

-- Functional index for case-insensitive name search
CREATE INDEX IF NOT EXISTS idx_names_name_lower 
ON Name(LOWER(name));

-- Functional index for case-insensitive type search
CREATE INDEX IF NOT EXISTS idx_names_type_lower 
ON Name(LOWER(type));
```

**For MariaDB/MySQL:**
```sql
-- MariaDB/MySQL doesn't support functional indexes directly
-- Alternative: Use generated columns (MySQL 5.7.6+, MariaDB 10.2+)
ALTER TABLE Ingredients 
ADD COLUMN ingredient_lower VARCHAR(255) 
GENERATED ALWAYS AS (LOWER(TRIM(ingredient))) STORED;

CREATE INDEX idx_ingredients_ingredient_lower ON Ingredients(ingredient_lower);

ALTER TABLE Name 
ADD COLUMN name_lower VARCHAR(255) 
GENERATED ALWAYS AS (LOWER(name)) STORED;

CREATE INDEX idx_names_name_lower ON Name(name_lower);

ALTER TABLE Name 
ADD COLUMN type_lower VARCHAR(255) 
GENERATED ALWAYS AS (LOWER(type)) STORED;

CREATE INDEX idx_names_type_lower ON Name(type_lower);
```

### Priority 2: Query Optimizations (High Impact, Medium Risk)

#### 2.1 Optimize Ingredient Search Query

**Current approach uses multiple EXISTS subqueries. Better approach:**

**For matchAll (recipes with ALL ingredients):**
```sql
-- More efficient: Use GROUP BY with HAVING COUNT
SELECT n.*
FROM Name n
INNER JOIN Ingredients i ON i.id = n.id
WHERE LOWER(TRIM(i.ingredient)) IN (?, ?, ?)  -- or use LIKE for partial matches
GROUP BY n.id
HAVING COUNT(DISTINCT LOWER(TRIM(i.ingredient))) = ?  -- number of ingredients
ORDER BY n.name ASC
LIMIT ? OFFSET ?;
```

**For matchAny (recipes with ANY ingredient):**
```sql
-- Use DISTINCT to avoid duplicates
SELECT DISTINCT n.*
FROM Name n
INNER JOIN Ingredients i ON i.id = n.id
WHERE LOWER(TRIM(i.ingredient)) LIKE ? 
   OR LOWER(TRIM(i.ingredient)) LIKE ?
   OR LOWER(TRIM(i.ingredient)) LIKE ?
ORDER BY n.name ASC
LIMIT ? OFFSET ?;
```

#### 2.2 Fix N+1 Query Problem in Quick Search

**Current code (routes/search.js, lines 260-283):**
```javascript
// BAD: Loops through each recipe
for (const recipe of result.rows) {
  const ingredientsQuery = `SELECT * FROM Ingredients WHERE id = ?`;
  // ... fetches one at a time
}
```

**Optimized approach:**
```javascript
// GOOD: Batch fetch all at once
const recipeIds = result.rows.map(r => r.id);

// Get all ingredients for all recipes in one query
const allIngredientsQuery = db.useMariaDB
  ? `SELECT * FROM Ingredients WHERE id IN (${recipeIds.map(() => '?').join(',')}) ORDER BY id`
  : `SELECT * FROM Ingredients WHERE id = ANY($1::int[]) ORDER BY id`;
const allIngredientsResult = await db.query(
  allIngredientsQuery, 
  db.useMariaDB ? recipeIds : [recipeIds]
);

// Group by recipe ID
const ingredientsByRecipe = {};
allIngredientsResult.rows.forEach(ing => {
  if (!ingredientsByRecipe[ing.id]) {
    ingredientsByRecipe[ing.id] = [];
  }
  ingredientsByRecipe[ing.id].push(ing);
});

// Same for cooking times and ratings
```

### Priority 3: Code Optimizations (Medium Impact, Low Risk)

#### 3.1 Add Query Result Caching

For frequently accessed data (e.g., all recipes list, type filters):
```javascript
// In app.js, add simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedRecipes() {
  const cacheKey = 'all-recipes';
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchAllRecipes();
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

#### 3.2 Debounce Ingredient Suggestions

**Current code (app.js, line 48):**
```javascript
ingredientInput.addEventListener('input', this.handleIngredientInput.bind(this));
```

**Optimized:**
```javascript
let suggestionTimeout;
ingredientInput.addEventListener('input', (e) => {
  clearTimeout(suggestionTimeout);
  suggestionTimeout = setTimeout(() => {
    this.handleIngredientInput(e);
  }, 300); // Wait 300ms after user stops typing
});
```

#### 3.3 Optimize Frontend Data Fetching

**Current code (app.js, line 122):**
```javascript
const response = await fetch('/api/tables/names?page=1&limit=1000');
```

**Issue:** Fetches 1000 recipes on page load. Better to:
- Fetch only what's needed initially (e.g., first 50)
- Use pagination
- Or fetch in background after initial render

### Priority 4: Database Schema Considerations (Low Priority)

#### 4.1 Consider Full-Text Search

For PostgreSQL, consider using full-text search instead of LIKE:
```sql
-- Add full-text search column
ALTER TABLE Name ADD COLUMN name_tsvector tsvector;
UPDATE Name SET name_tsvector = to_tsvector('english', name);
CREATE INDEX idx_names_name_fts ON Name USING GIN(name_tsvector);

-- Query using full-text search
SELECT * FROM Name 
WHERE name_tsvector @@ to_tsquery('english', 'search & term')
ORDER BY ts_rank(name_tsvector, to_tsquery('english', 'search & term')) DESC;
```

For MariaDB/MySQL, consider using FULLTEXT indexes:
```sql
ALTER TABLE Name ADD FULLTEXT(name, type);
SELECT * FROM Name 
WHERE MATCH(name, type) AGAINST('search term' IN NATURAL LANGUAGE MODE);
```

#### 4.2 Consider Materialized Views

For complex searches that are run frequently, consider materialized views:
```sql
CREATE MATERIALIZED VIEW recipe_search_index AS
SELECT 
  n.id,
  n.name,
  n.type,
  STRING_AGG(DISTINCT LOWER(TRIM(i.ingredient)), ', ') as ingredients_list
FROM Name n
LEFT JOIN Ingredients i ON i.id = n.id
GROUP BY n.id, n.name, n.type;

CREATE INDEX idx_recipe_search_ingredients ON recipe_search_index USING GIN(to_tsvector('english', ingredients_list));
```

## Implementation Priority

1. **Immediate (Do First):**
   - Add missing indexes on `Ingredients.id`, `CookingTimes.id`, `Ratings.id`
   - Fix N+1 query problem in quick search (routes/search.js)
   - Add functional indexes for case-insensitive searches (if database supports)

2. **Short Term (Next Sprint):**
   - Optimize ingredient search query (use GROUP BY instead of multiple EXISTS)
   - Add debouncing to ingredient suggestions
   - Optimize frontend data fetching (reduce initial load)

3. **Medium Term (Future Enhancement):**
   - Add query result caching
   - Consider full-text search for better search quality
   - Add database query monitoring/logging

## Expected Performance Improvements

- **Ingredient Search:** 50-80% faster with proper indexes and optimized queries
- **Quick Search:** 60-90% faster by eliminating N+1 queries
- **Browse Recipes:** 40-60% faster with batch queries
- **Ingredient Suggestions:** 30-50% faster with functional indexes

## Testing Recommendations

1. Test with large datasets (1000+ recipes, 10+ ingredients per recipe)
2. Monitor query execution times before and after changes
3. Use `EXPLAIN ANALYZE` (PostgreSQL) or `EXPLAIN` (MariaDB) to verify index usage
4. Load test with concurrent users

## Notes

- The current code uses `id` field to join tables, but some schemas might use `recipe_id`. Verify your actual schema before applying indexes.
- Some optimizations require database-specific features (e.g., functional indexes in PostgreSQL vs generated columns in MariaDB)
- Always test in a development environment before applying to production

