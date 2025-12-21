# Poultry Column Population Script

This script automatically populates the `Poultry` column in the `Name` table based on the ingredients in each recipe.

## Features

- ✅ Automatically detects if the `Poultry` column exists and adds it if missing
- ✅ Configurable list of poultry keywords for easy fine-tuning
- ✅ Supports both PostgreSQL and MariaDB/MySQL
- ✅ Dry-run mode to preview changes before applying
- ✅ Verbose mode to see detailed matching information
- ✅ Option to only update NULL values

## Usage

### Basic Usage (Update all recipes)
```bash
node scripts/populate-poultry.js
```

### Dry Run (Preview changes without updating)
```bash
node scripts/populate-poultry.js --dry-run
# or
node scripts/populate-poultry.js -d
```

### Only Update NULL Values
```bash
node scripts/populate-poultry.js --only-null
# or
node scripts/populate-poultry.js -n
```

### Verbose Output (Show detailed matches)
```bash
node scripts/populate-poultry.js --verbose
# or
node scripts/populate-poultry.js -v
```

### Combine Options
```bash
# Dry run with verbose output
node scripts/populate-poultry.js --dry-run --verbose

# Only update NULL values with verbose output
node scripts/populate-poultry.js --only-null --verbose
```

## Configuration

To adjust the poultry detection logic, edit the `POULTRY_KEYWORDS` array in `scripts/populate-poultry.js`:

```javascript
const POULTRY_KEYWORDS = [
  'chicken',
  'turkey',
  'duck',
  // Add or remove keywords here
];
```

### How Keywords Are Matched

- Keywords are matched case-insensitively
- Uses word boundary matching (e.g., "chicken" matches "chicken breast" but not "chickensoup")
- Multiple keywords can match the same ingredient
- If ANY ingredient contains a poultry keyword, the recipe is marked as containing poultry

## Examples

### Example 1: First Run
```bash
# Preview what will happen
node scripts/populate-poultry.js --dry-run --verbose

# If satisfied, run for real
node scripts/populate-poultry.js
```

### Example 2: Fine-tuning Keywords
1. Edit `POULTRY_KEYWORDS` in the script
2. Run with dry-run to see the changes:
   ```bash
   node scripts/populate-poultry.js --dry-run --verbose
   ```
3. Adjust keywords as needed
4. Run again until satisfied
5. Apply changes:
   ```bash
   node scripts/populate-poultry.js
   ```

### Example 3: Re-running After Adding New Recipes
```bash
# Only update recipes that don't have a Poultry value yet
node scripts/populate-poultry.js --only-null
```

## Output

The script provides detailed output including:
- Configuration summary
- Column existence check
- Recipe analysis progress
- Update summary
- Final statistics

### Sample Output
```
🐔 Starting Poultry Column Population
============================================================
Configuration:
  - Dry Run: NO (will update database)
  - Only Update NULL: NO
  - Verbose: NO
  - Poultry Keywords: 30 keywords configured
============================================================

📋 Step 1: Checking for Poultry column...
   ✅ Poultry column already exists

📋 Step 2: Fetching all recipes...
   ✅ Found 150 recipes

📋 Step 3: Analyzing recipes for poultry ingredients...

   ✅ Analysis complete:
      - Recipes to update: 45
      - Recipes unchanged: 105
      - Recipes skipped: 0

📋 Step 4: Updating database...
   ✅ Update complete:
      - Successfully updated: 45

============================================================
✅ Poultry population process completed!
============================================================

📊 Final Statistics:
   - Total recipes: 150
   - Recipes with poultry: 45
   - Recipes without poultry: 105
```

## Troubleshooting

### Column Already Exists Error
If you get an error about the column already existing, the script will handle it gracefully. The column check happens before any updates.

### No Recipes Found
If no recipes are found, check:
- Database connection settings in `config.js`
- Table name (should be `Name`, not `Names`)
- Database contains recipe data

### Keywords Not Matching
- Check that keywords are in lowercase in the array (matching is case-insensitive)
- Use verbose mode to see which ingredients are being checked
- Add more specific keywords if needed (e.g., "chicken breast" instead of just "chicken")

## Notes

- The script uses the `id` field to link recipes (`Name` table) with ingredients (`Ingredients` table)
- The `Poultry` column is a BOOLEAN type (TRUE/FALSE)
- The script is idempotent - you can run it multiple times safely
- Changes are permanent once applied (unless using dry-run mode)

