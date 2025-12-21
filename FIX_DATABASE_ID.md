# Fixing "Field 'id' doesn't have a default value" Error

This error occurs when the `Name` table's `id` field doesn't have AUTO_INCREMENT set properly.

## Quick Fix: Verify and Fix Table Structure

### Step 1: Check Current Table Structure

**For MariaDB:**
```bash
mysql -u your_user -p recepie_db
```

Then run:
```sql
DESCRIBE Name;
-- or
SHOW CREATE TABLE Name;
```

**For PostgreSQL:**
```bash
psql -U your_user -d recepie_db
```

Then run:
```sql
\d Name
-- or
SELECT column_name, column_default, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'Name';
```

### Step 2: Fix the Table Structure

**If the `id` field doesn't have AUTO_INCREMENT (MariaDB) or SERIAL (PostgreSQL):**

**For MariaDB:**
```sql
ALTER TABLE Name MODIFY id INT AUTO_INCREMENT PRIMARY KEY;
```

**For PostgreSQL:**
```sql
-- If using SERIAL, it should already be auto-increment
-- But if not, you might need to recreate the sequence:
CREATE SEQUENCE IF NOT EXISTS name_id_seq;
ALTER TABLE Name ALTER COLUMN id SET DEFAULT nextval('name_id_seq');
```

### Step 3: Alternative - Recreate the Table

If the above doesn't work, you can recreate the table:

**For MariaDB:**
```sql
-- Backup data first!
CREATE TABLE Name_backup AS SELECT * FROM Name;

-- Drop and recreate
DROP TABLE Name;
CREATE TABLE Name (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Restore data (if needed)
-- INSERT INTO Name (name, type) SELECT name, type FROM Name_backup;
```

**For PostgreSQL:**
```sql
-- Backup data first!
CREATE TABLE Name_backup AS SELECT * FROM Name;

-- Drop and recreate
DROP TABLE Name;
CREATE TABLE Name (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restore data (if needed)
-- INSERT INTO Name (name, type) SELECT name, type FROM Name_backup;
```

### Step 4: Run Database Initialization

If you're not sure about the table structure, re-run the initialization:

```bash
cd /volume1/homes/Martin/recept
npm run init-db
```

This will create all tables with the correct structure (it uses `CREATE TABLE IF NOT EXISTS`, so it won't overwrite existing data, but it also won't fix existing tables).

## Verify the Fix

After fixing, try creating a recipe again. The error should be resolved.

## Check Which Database You're Using

Check your `.env` file:
```bash
cat /volume1/homes/Martin/recept/.env | grep DB_TYPE
```

- `DB_TYPE=mariadb` or `DB_TYPE=mysql` → Use MariaDB commands above
- `DB_TYPE=postgres` or no DB_TYPE → Use PostgreSQL commands above

