// Test different ports to find the correct one
require('dotenv').config();
const mysql = require('mysql2/promise');
const config = require('../config');

const portsToTest = [3306, 3307, 3308, 5432];
const host = config.database.host || '127.0.0.1';
const user = config.database.user;
const password = config.database.password;
const database = config.database.database;

console.log('='.repeat(60));
console.log('Port Testing - Finding the correct database port');
console.log('='.repeat(60));
console.log('');
console.log(`Testing connection to: ${host}`);
console.log(`Database: ${database}`);
console.log(`User: ${user}`);
console.log('');
console.log('Testing ports:', portsToTest.join(', '));
console.log('');

let foundPort = null;

async function testPort(port) {
  try {
    const pool = mysql.createPool({
      host: host,
      port: port,
      database: database,
      user: user,
      password: password,
      connectTimeout: 2000, // 2 second timeout
    });
    
    const [rows] = await pool.execute('SELECT 1 as test, DATABASE() as db_name, VERSION() as version');
    await pool.end();
    return { success: true, port: port, info: rows[0] };
  } catch (error) {
    return { success: false, port: port, error: error.message };
  }
}

async function testAllPorts() {
  for (const port of portsToTest) {
    process.stdout.write(`Testing port ${port}... `);
    const result = await testPort(port);
    
    if (result.success) {
      console.log(`✅ SUCCESS!`);
      console.log(`   Database: ${result.info.db_name}`);
      console.log(`   Version: ${result.info.version}`);
      foundPort = port;
    } else {
      if (result.error.includes('ECONNREFUSED')) {
        console.log(`❌ Connection refused`);
      } else if (result.error.includes('Access denied')) {
        console.log(`⚠️  Access denied (wrong credentials or database name)`);
      } else {
        console.log(`❌ ${result.error}`);
      }
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
  
  if (foundPort) {
    console.log('');
    console.log(`✅ Found working port: ${foundPort}`);
    console.log('');
    console.log('Please update your .env file:');
    console.log(`   DB_PORT=${foundPort}`);
    console.log('');
    console.log('Then run the populate-poultry script again.');
  } else {
    console.log('');
    console.log('❌ Could not connect on any tested port.');
    console.log('');
    console.log('Please check:');
    console.log('  1. What port did you use when connecting manually?');
    console.log('  2. What command did you use? (e.g., mysql -h 127.0.0.1 -P ??? -u ...)');
    console.log('  3. Is MariaDB/MySQL service running?');
    console.log('  4. Check MariaDB configuration file (my.cnf or my.ini) for the port setting');
  }
}

testAllPorts().then(() => process.exit(foundPort ? 0 : 1));

