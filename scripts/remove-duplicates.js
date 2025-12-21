// Load environment variables first
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseService = require('../services/database');
const config = require('../config');
const fs = require('fs');

// Tables to check for duplicates
const TABLES_TO_CHECK = [
  'Name'
];

//  'Names',
// 'Ingredients',
// 'Instructions',
// 'CookingTimes',
// 'Ratings'


// Set to true to preview changes without updating the database
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

// Set to true to use the saved duplicates file
const USE_SAVED_FILE = process.argv.includes('--use-saved') || process.argv.includes('-s');

// Set to true to only process the first duplicate ID (for testing)
const FIRST_ONLY = process.argv.includes('--first-only') || process.argv.includes('-f');

async function removeDuplicates() {
  const db = new DatabaseService();
  
  try {
    console.log('🗑️  Removing duplicate IDs from database...');
    console.log('='.repeat(60));
    console.log(`Database: ${config.database.database}`);
    console.log(`Type: ${db.useMariaDB ? 'MariaDB/MySQL' : 'PostgreSQL'}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (will delete duplicates)'}`);
    if (FIRST_ONLY) {
      console.log(`⚠️  FIRST ONLY MODE: Will only process the first duplicate ID`);
    }
    console.log('='.repeat(60));
    console.log('');

    let totalRemoved = 0;
    const removalSummary = {};

    // Try to load saved duplicates file if requested
    let savedDuplicates = null;
    if (USE_SAVED_FILE) {
      const savedFile = path.join(__dirname, 'duplicates-found.json');
      if (fs.existsSync(savedFile)) {
        savedDuplicates = JSON.parse(fs.readFileSync(savedFile, 'utf8'));
        console.log(`📂 Loaded duplicates from: ${savedFile}`);
        console.log('');
      } else {
        console.log(`⚠️  Saved file not found: ${savedFile}`);
        console.log(`   Will find duplicates now...`);
        console.log('');
      }
    }

    for (const tableName of TABLES_TO_CHECK) {
      try {
        // Check if table exists
        const tableExistsQuery = db.useMariaDB
          ? `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`
          : `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`;
        
        const tableExistsResult = await db.query(
          tableExistsQuery,
          db.useMariaDB ? [config.database.database, tableName] : [tableName]
        );
        
        const tableExists = db.useMariaDB 
          ? tableExistsResult.rows[0].count > 0
          : parseInt(tableExistsResult.rows[0].count) > 0;

        if (!tableExists) {
          console.log(`⏭️  Table "${tableName}" does not exist, skipping...`);
          continue;
        }

        let duplicates = [];

        // Use saved duplicates if available, otherwise find them
        if (savedDuplicates && savedDuplicates[tableName]) {
          duplicates = savedDuplicates[tableName];
          console.log(`📋 Using saved duplicates for table "${tableName}"`);
          
          // If FIRST_ONLY mode, only process the first duplicate
          if (FIRST_ONLY && duplicates.length > 0) {
            duplicates = [duplicates[0]];
            console.log(`⚠️  FIRST ONLY MODE: Processing only the first duplicate (ID: ${duplicates[0].id})`);
            console.log(`   (${savedDuplicates[tableName].length - 1} other duplicate(s) will be skipped)`);
          }
        } else {
          // Find duplicate IDs
          const duplicateQuery = db.useMariaDB
            ? `SELECT id, COUNT(*) as count FROM ${tableName} GROUP BY id HAVING COUNT(*) > 1 ORDER BY id`
            : `SELECT id, COUNT(*) as count FROM "${tableName}" GROUP BY id HAVING COUNT(*) > 1 ORDER BY id`;
          
          const duplicateResult = await db.query(duplicateQuery);
          
          if (duplicateResult.rows.length === 0) {
            console.log(`✅ No duplicates found in table "${tableName}"`);
            continue;
          }

          // Get details for each duplicate
          let processedCount = 0;
          for (const dup of duplicateResult.rows) {
            // If FIRST_ONLY mode, only process the first duplicate
            if (FIRST_ONLY && processedCount > 0) {
              break;
            }
            
            const duplicateId = dup.id;
            const detailQuery = db.useMariaDB
              ? `SELECT * FROM ${tableName} WHERE id = ? ORDER BY id`
              : `SELECT * FROM "${tableName}" WHERE id = $1 ORDER BY id`;
            
            const detailResult = await db.query(detailQuery, [duplicateId]);
            duplicates.push({
              id: duplicateId,
              count: db.useMariaDB ? dup.count : parseInt(dup.count),
              rows: detailResult.rows
            });
            processedCount++;
          }
          
          // If FIRST_ONLY mode, show how many were skipped
          if (FIRST_ONLY && duplicateResult.rows.length > 1) {
            console.log(`⚠️  FIRST ONLY MODE: Processing only the first duplicate (ID: ${duplicates[0].id})`);
            console.log(`   (${duplicateResult.rows.length - 1} other duplicate(s) will be skipped)`);
          }
        }

        if (duplicates.length === 0) {
          console.log(`✅ No duplicates found in table "${tableName}"`);
          continue;
        }

        console.log(`🔍 Processing ${duplicates.length} duplicate ID(s) in table "${tableName}"...`);
        removalSummary[tableName] = { removed: 0, kept: 0 };

        for (const dup of duplicates) {
          const duplicateId = dup.id;
          const duplicateRows = dup.rows || [];
          const count = dup.count || duplicateRows.length;

          if (duplicateRows.length < 2) {
            console.log(`   ⚠️  ID ${duplicateId}: Only ${duplicateRows.length} row(s) found, skipping...`);
            continue;
          }

          // Strategy: Keep the first row, delete the rest
          // For tables with timestamps, we could keep the newest, but for simplicity, we keep the first
          const rowsToKeep = [duplicateRows[0]];
          const rowsToDelete = duplicateRows.slice(1);

          console.log(`   📝 ID ${duplicateId}: Keeping 1 row, removing ${rowsToDelete.length} duplicate(s)`);

          if (DRY_RUN) {
            console.log(`      [DRY RUN] Would delete ${rowsToDelete.length} row(s) with ID ${duplicateId}`);
            removalSummary[tableName].removed += rowsToDelete.length;
            removalSummary[tableName].kept += 1;
          } else {
            // Delete duplicates
            // Strategy: Use a temporary table or delete using row identifiers
            // For tables where id is the primary key (Name/Names), we can't have true duplicates
            // For other tables (Ingredients, Instructions, etc.), id is a foreign key reference
            // and we can have multiple rows with the same id
            
            try {
              if (tableName === 'Name' || tableName === 'Names') {
                // For Name table, id should be unique (primary key)
                // If we have duplicates here, it's a serious issue - keep the first one
                console.log(`      ⚠️  Warning: Duplicate primary keys in ${tableName} table!`);
                console.log(`      This should not happen. Keeping first row, but you should investigate.`);
                
                // Delete all and re-insert the one to keep
                const deleteQuery = db.useMariaDB
                  ? `DELETE FROM ${tableName} WHERE id = ?`
                  : `DELETE FROM "${tableName}" WHERE id = $1`;
                
                await db.query(deleteQuery, [duplicateId]);
                
                // Re-insert the row to keep
                const rowToKeep = rowsToKeep[0];
                const columns = Object.keys(rowToKeep).filter(col => col !== 'id');
                const values = columns.map(col => rowToKeep[col]);
                
                const placeholders = db.useMariaDB
                  ? values.map(() => '?').join(', ')
                  : values.map((_, i) => `$${i + 1}`).join(', ');
                
                const columnList = db.useMariaDB
                  ? columns.join(', ')
                  : columns.map(col => `"${col}"`).join(', ');
                
                const insertQuery = db.useMariaDB
                  ? `INSERT INTO ${tableName} (id, ${columnList}) VALUES (?, ${placeholders})`
                  : `INSERT INTO "${tableName}" (id, ${columnList}) VALUES ($${values.length + 1}, ${placeholders})`;
                
                await db.query(insertQuery, [duplicateId, ...values]);
              } else {
                // For other tables, we need to delete specific duplicate rows
                // We'll use a subquery with ROW_NUMBER or delete all and re-insert one
                
                // Get the primary key column name for this table
                const pkQuery = db.useMariaDB
                  ? `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' LIMIT 1`
                  : `SELECT column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY' LIMIT 1`;
                
                const pkResult = await db.query(
                  pkQuery,
                  db.useMariaDB ? [config.database.database, tableName] : [tableName]
                );
                
                const pkColumn = pkResult.rows.length > 0 ? pkResult.rows[0].COLUMN_NAME || pkResult.rows[0].column_name : null;
                
                if (pkColumn && pkColumn !== 'id') {
                  // Table has a different primary key - delete duplicates using that
                  const rowToKeep = rowsToKeep[0];
                  const pkValue = rowToKeep[pkColumn];
                  
                  // Delete all rows with this id except the one with the primary key we want to keep
                  const deleteQuery = db.useMariaDB
                    ? `DELETE FROM ${tableName} WHERE id = ? AND ${pkColumn} != ?`
                    : `DELETE FROM "${tableName}" WHERE id = $1 AND "${pkColumn}" != $2`;
                  
                  await db.query(deleteQuery, [duplicateId, pkValue]);
                } else {
                  // No separate primary key or id is the primary key
                  // Delete all rows with this id, then re-insert the one to keep
                  const deleteQuery = db.useMariaDB
                    ? `DELETE FROM ${tableName} WHERE id = ?`
                    : `DELETE FROM "${tableName}" WHERE id = $1`;
                  
                  await db.query(deleteQuery, [duplicateId]);
                  
                  // Re-insert the row to keep
                  const rowToKeep = rowsToKeep[0];
                  const columns = Object.keys(rowToKeep);
                  const values = columns.map(col => rowToKeep[col]);
                  
                  const placeholders = db.useMariaDB
                    ? values.map(() => '?').join(', ')
                    : values.map((_, i) => `$${i + 1}`).join(', ');
                  
                  const columnList = db.useMariaDB
                    ? columns.join(', ')
                    : columns.map(col => `"${col}"`).join(', ');
                  
                  const insertQuery = db.useMariaDB
                    ? `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`
                    : `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`;
                  
                  await db.query(insertQuery, values);
                }
              }
              
              console.log(`      ✅ Removed ${rowsToDelete.length} duplicate(s), kept 1 row`);
              removalSummary[tableName].removed += rowsToDelete.length;
              removalSummary[tableName].kept += 1;
              totalRemoved += rowsToDelete.length;
            } catch (deleteError) {
              console.error(`      ❌ Error removing duplicates for ID ${duplicateId}:`, deleteError.message);
              console.error(`      💡 You may need to manually remove duplicates for ID ${duplicateId}`);
            }
          }
        }
        console.log('');
      } catch (error) {
        console.error(`❌ Error processing table "${tableName}":`, error.message);
        console.log('');
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`📊 Removal Summary:`);
    console.log(`   Total rows removed: ${totalRemoved}`);
    if (FIRST_ONLY) {
      console.log(`   ⚠️  FIRST ONLY MODE: Only processed the first duplicate ID`);
    }
    console.log('');
    
    for (const [table, summary] of Object.entries(removalSummary)) {
      if (summary.removed > 0 || summary.kept > 0) {
        console.log(`   ${table}:`);
        console.log(`      - Kept: ${summary.kept} row(s)`);
        console.log(`      - Removed: ${summary.removed} duplicate(s)`);
      }
    }
    
    console.log('='.repeat(60));

    if (DRY_RUN) {
      console.log('');
      console.log('ℹ️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to actually remove duplicates.');
    } else {
      console.log('');
      if (FIRST_ONLY) {
        console.log('✅ Duplicate removal completed (first duplicate only)!');
        console.log('   Run without --first-only to process all duplicates.');
      } else {
        console.log('✅ Duplicate removal completed!');
      }
    }

  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  removeDuplicates();
}

module.exports = { removeDuplicates };

