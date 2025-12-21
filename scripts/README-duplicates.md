# Duplicate Detection and Removal Scripts

These scripts help identify and remove duplicate records from your recipe database.

## Scripts

1. **`find-duplicates.js`** - Identifies all duplicate IDs in the database
2. **`remove-duplicates.js`** - Removes duplicate records, keeping one instance of each

## Usage

### Step 1: Find Duplicates

First, run the find script to identify all duplicates:

```bash
node scripts/find-duplicates.js
```

This will:
- Check all tables (Name, Names, Ingredients, Instructions, CookingTimes, Ratings)
- Display duplicate IDs and their details
- Save results to `scripts/duplicates-found.json` for review

**Output:**
- Shows which tables have duplicates
- Lists each duplicate ID and how many copies exist
- Saves detailed information to a JSON file

### Step 2: Review Duplicates (Optional)

Review the generated `scripts/duplicates-found.json` file to see what will be removed.

### Step 3: Remove Duplicates

#### Dry Run (Recommended First)

Test the removal without making changes:

```bash
node scripts/remove-duplicates.js --dry-run
```

or

```bash
node scripts/remove-duplicates.js -d
```

#### Use Saved Duplicates File

If you want to use the duplicates found in step 1:

```bash
node scripts/remove-duplicates.js --use-saved
```

or

```bash
node scripts/remove-duplicates.js -s
```

#### Actually Remove Duplicates

Once you're satisfied with the dry run:

```bash
node scripts/remove-duplicates.js
```

**⚠️ WARNING: This will permanently delete duplicate records!**

## How It Works

### Finding Duplicates

The script checks for duplicate `id` values in each table:
- For `Name`/`Names` tables: Duplicate primary keys (shouldn't happen normally)
- For other tables: Duplicate foreign key references (multiple rows with same recipe `id`)

### Removing Duplicates

For each duplicate ID:
1. **Keeps**: The first row found
2. **Removes**: All other duplicate rows

**Strategy:**
- For `Name`/`Names` tables: Deletes all rows with the duplicate ID, then re-inserts the first one
- For other tables: Deletes duplicates while preserving the first row

## Examples

### Example 1: Find and Review

```bash
# Find duplicates
node scripts/find-duplicates.js

# Review the output and duplicates-found.json file

# Test removal (dry run)
node scripts/remove-duplicates.js --dry-run --use-saved

# Actually remove
node scripts/remove-duplicates.js --use-saved
```

### Example 2: Find and Remove in One Go

```bash
# Find duplicates
node scripts/find-duplicates.js

# Remove duplicates (will find them again if not using --use-saved)
node scripts/remove-duplicates.js
```

## Tables Checked

The scripts check these tables for duplicates:
- `Name` / `Names` - Recipe names
- `Ingredients` - Recipe ingredients
- `Instructions` - Recipe instructions
- `CookingTimes` - Cooking times
- `Ratings` - Recipe ratings

## Notes

- The scripts work with both MariaDB/MySQL and PostgreSQL
- Duplicates are identified by the `id` column
- The first row found is always kept
- For tables with composite primary keys, the script handles them appropriately
- Always run a dry run first to see what will be removed!

## Troubleshooting

### "Table does not exist"
- The script will skip tables that don't exist in your database
- This is normal if you're using a different schema

### "Error removing duplicates"
- Check the error message for details
- You may need to manually remove some duplicates
- Ensure you have proper database permissions

### "No duplicates found"
- Great! Your database is clean
- Run the find script periodically to check for new duplicates

