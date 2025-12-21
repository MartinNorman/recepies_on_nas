// Simple connection test script
require('dotenv').config();
const config = require('../config');

console.log('='.repeat(60));
console.log('Connection Test - Checking Configuration');
console.log('='.repeat(60));
console.log('');
console.log('Environment Variables from .env:');
console.log(`  DB_TYPE: ${process.env.DB_TYPE || 'NOT SET'}`);
console.log(`  DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`  DB_PORT: ${process.env.DB_PORT || 'NOT SET'}`);
console.log(`  DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
console.log(`  DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '***SET***' : 'NOT SET'}`);
console.log('');
console.log('Resolved Configuration (from config.js):');
console.log(`  Type: ${config.database.type}`);
console.log(`  Host: ${config.database.host}`);
console.log(`  Port: ${config.database.port}`);
console.log(`  Database: ${config.database.database}`);
console.log(`  User: ${config.database.user}`);
console.log(`  Password: ${config.database.password ? '***SET***' : 'NOT SET'}`);
console.log('');
console.log('='.repeat(60));

// Test connection
const DatabaseService = require('../services/database');
const db = new DatabaseService();

console.log('');
console.log('Testing database connection...');
console.log('');

db.query('SELECT 1 as test')
  .then(result => {
    console.log('✅ SUCCESS! Database connection works!');
    console.log('Result:', result.rows);
    console.log('');
    console.log('You can now run: node scripts/populate-poultry.js --dry-run');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ CONNECTION FAILED!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Please check:');
    console.error('  1. The port number matches what you used to connect manually');
    console.error('  2. The database name is correct (case-sensitive in some setups)');
    console.error('  3. The .env file is in the project root directory');
    console.error('  4. All environment variables are set correctly');
    process.exit(1);
  });

