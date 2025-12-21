// Load environment variables first
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseService = require('../services/database');
const config = require('../config');

// Only check the Name table for duplicate recipes
const TABLES_TO_CHECK = ['Name'];


async function findDuplicates() {
  const db = new DatabaseService();
  
  try {
    console.log('🔍 Searching for duplicate recipe IDs in database...');
    console.log('='.repeat(60));
    console.log(`Database: ${config.database.database}`);
    console.log(`Type: ${db.useMariaDB ? 'MariaDB/MySQL' : 'PostgreSQL'}`);
    console.log('='.repeat(60));
    console.log('');

    let totalDuplicates = 0;
    const allDuplicates = {};
    let tableName = TABLES_TO_CHECK[0]; // Use 'Name'
    let actualTableName = tableName;

    // Check if Name table exists, fallback to Names
    try {
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
        // Try fallback table 'Names'
        const fallbackResult = await db.query(
          tableExistsQuery,
          db.useMariaDB ? [config.database.database, 'Names'] : ['Names']
        );
        
        const fallbackExists = db.useMariaDB 
          ? fallbackResult.rows[0].count > 0
          : parseInt(fallbackResult.rows[0].count) > 0;
        
        if (!fallbackExists) {
          console.log(`❌ Neither "Name" nor "Names" table exists!`);
          process.exit(1);
        }
        
        actualTableName = 'Names';
      }
    } catch (error) {
      console.error(`❌ Error checking for table:`, error.message);
      process.exit(1);
    }

    // Find duplicate IDs
    const duplicateQuery = db.useMariaDB
      ? `SELECT id, COUNT(*) as count FROM ${actualTableName} GROUP BY id HAVING COUNT(*) > 1 ORDER BY id`
      : `SELECT id, COUNT(*) as count FROM "${actualTableName}" GROUP BY id HAVING COUNT(*) > 1 ORDER BY id`;
    
    const duplicates = await db.query(duplicateQuery);
    
    // Only show output if duplicates are found
    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicate recipes found in the database.');
      console.log('');
      process.exit(0);
    }

    console.log(`❌ Found ${duplicates.rows.length} duplicate recipe ID(s):`);
    console.log('');
    
    for (const dup of duplicates.rows) {
      const duplicateId = dup.id;
      const count = db.useMariaDB ? dup.count : parseInt(dup.count);
      
      // Get all rows with this duplicate ID
      const detailQuery = db.useMariaDB
        ? `SELECT * FROM ${actualTableName} WHERE id = ? ORDER BY id`
        : `SELECT * FROM "${actualTableName}" WHERE id = $1 ORDER BY id`;
      
      const detailResult = await db.query(detailQuery, [duplicateId]);
      
      // Show recipe details in a more readable format
      const firstRow = detailResult.rows[0];
      const recipeName = firstRow.name || '(unnamed)';
      const recipeType = firstRow.type || '(no type)';
      
      console.log(`   📝 Recipe ID ${duplicateId}: "${recipeName}" (${recipeType})`);
      console.log(`      Found ${count} duplicate(s):`);
      
      // Show details of each duplicate
      detailResult.rows.forEach((row, index) => {
        const name = row.name || '(unnamed)';
        const type = row.type || '(no type)';
        const description = row.description ? (row.description.length > 50 ? row.description.substring(0, 50) + '...' : row.description) : null;
        
        console.log(`      ${index + 1}. Name: "${name}" | Type: "${type}"`);
        if (description) {
          console.log(`         Description: ${description}`);
        }
        // Show other fields if they differ
        const otherFields = Object.keys(row).filter(key => !['id', 'name', 'type', 'description'].includes(key) && row[key] !== null && row[key] !== undefined);
        if (otherFields.length > 0) {
          const otherData = otherFields.map(key => `${key}: ${row[key]}`).join(', ');
          if (otherData.length < 100) {
            console.log(`         Other: ${otherData}`);
          }
        }
      });
      
      allDuplicates[actualTableName] = allDuplicates[actualTableName] || [];
      allDuplicates[actualTableName].push({
        id: duplicateId,
        count: count,
        rows: detailResult.rows
      });
      
      totalDuplicates += count - 1; // -1 because we keep one
      console.log('');
    }

    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total duplicate recipes found: ${duplicates.rows.length}`);
    console.log(`   Total duplicate rows to remove: ${totalDuplicates}`);
    console.log('='.repeat(60));

    // Save results to a JSON file for the removal script
    const fs = require('fs');
    const outputFile = path.join(__dirname, 'duplicates-found.json');
    fs.writeFileSync(outputFile, JSON.stringify(allDuplicates, null, 2));
    console.log('');
    console.log(`💾 Duplicate details saved to: ${outputFile}`);
    console.log(`   You can review this file before running the removal script.`);
    console.log('');
    console.log(`💡 Next step: Run "node scripts/remove-duplicates.js --dry-run" to preview removal`);

  } catch (error) {
    console.error('❌ Error finding duplicates:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  findDuplicates();
}

module.exports = { findDuplicates };

