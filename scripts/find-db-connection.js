// Find the correct database connection method
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('Finding Database Connection Method');
console.log('='.repeat(60));
console.log('');

// Common socket locations on Windows
const socketPaths = [
  'C:/xampp/mysql/mysql.sock',
  'C:/wamp/bin/mysql/mysql5.x.x/data/mysql.sock',
  'C:/Program Files/MariaDB/data/mysql.sock',
  'C:/Program Files/MySQL/MySQL Server 8.0/data/mysql.sock',
];

// Common ports to test
const portsToTest = [3306, 3307, 3308, 33000];

console.log('Method 1: Testing TCP/IP connections...');
console.log('');

async function testTCPConnection(host, port) {
  try {
    const connection = await mysql.createConnection({
      host: host,
      port: port,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 2000,
    });
    const [rows] = await connection.query('SELECT DATABASE() as db, VERSION() as version, @@port as port');
    await connection.end();
    return { success: true, method: 'TCP/IP', host, port, info: rows[0] };
  } catch (error) {
    return { success: false, method: 'TCP/IP', host, port, error: error.message };
  }
}

async function testSocketConnection(socketPath) {
  try {
    if (!fs.existsSync(socketPath)) {
      return { success: false, method: 'Socket', socket: socketPath, error: 'Socket file not found' };
    }
    const connection = await mysql.createConnection({
      socketPath: socketPath,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 2000,
    });
    const [rows] = await connection.query('SELECT DATABASE() as db, VERSION() as version');
    await connection.end();
    return { success: true, method: 'Socket', socket: socketPath, info: rows[0] };
  } catch (error) {
    return { success: false, method: 'Socket', socket: socketPath, error: error.message };
  }
}

async function findConnection() {
  const hosts = ['127.0.0.1', 'localhost'];
  let found = false;

  // Test TCP/IP connections
  for (const host of hosts) {
    for (const port of portsToTest) {
      process.stdout.write(`Testing ${host}:${port}... `);
      const result = await testTCPConnection(host, port);
      if (result.success) {
        console.log('✅ SUCCESS!');
        console.log(`   Database: ${result.info.db}`);
        console.log(`   Version: ${result.info.version}`);
        console.log(`   Port: ${result.info.port}`);
        console.log('');
        console.log('✅ Found working connection!');
        console.log(`   Method: ${result.method}`);
        console.log(`   Host: ${result.host}`);
        console.log(`   Port: ${result.port}`);
        console.log('');
        console.log('Update your .env file:');
        console.log(`   DB_HOST=${result.host}`);
        console.log(`   DB_PORT=${result.port}`);
        found = true;
        return;
      } else {
        if (result.error.includes('ECONNREFUSED')) {
          console.log('❌ Connection refused');
        } else {
          console.log(`❌ ${result.error.substring(0, 50)}`);
        }
      }
    }
  }

  console.log('');
  console.log('Method 2: Checking for socket files...');
  console.log('');

  // Test socket connections
  for (const socketPath of socketPaths) {
    if (fs.existsSync(socketPath)) {
      process.stdout.write(`Testing socket: ${socketPath}... `);
      const result = await testSocketConnection(socketPath);
      if (result.success) {
        console.log('✅ SUCCESS!');
        console.log(`   Database: ${result.info.db}`);
        console.log(`   Version: ${result.info.version}`);
        console.log('');
        console.log('✅ Found working connection!');
        console.log(`   Method: ${result.method}`);
        console.log(`   Socket: ${result.socket}`);
        console.log('');
        console.log('Note: Socket connections require different configuration.');
        console.log('You may need to configure MariaDB to accept TCP/IP connections.');
        found = true;
        return;
      } else {
        console.log(`❌ ${result.error.substring(0, 50)}`);
      }
    }
  }

  if (!found) {
    console.log('');
    console.log('❌ Could not find a working connection method.');
    console.log('');
    console.log('Since you can connect via phpMyAdmin, please check:');
    console.log('  1. phpMyAdmin config file (usually config.inc.php)');
    console.log('     Look for: $cfg[\'Servers\'][$i][\'host\'] and $cfg[\'Servers\'][$i][\'port\']');
    console.log('  2. MariaDB/MySQL configuration file (my.ini or my.cnf)');
    console.log('     Look for: port = and bind-address');
    console.log('  3. Check if MariaDB is configured to only accept socket connections');
    console.log('     You may need to enable TCP/IP connections in my.ini');
    console.log('');
    console.log('To enable TCP/IP in MariaDB:');
    console.log('  1. Find my.ini (usually in MariaDB installation directory)');
    console.log('  2. Look for [mysqld] section');
    console.log('  3. Ensure these lines exist:');
    console.log('     port = 3306');
    console.log('     bind-address = 127.0.0.1');
    console.log('  4. Restart MariaDB service');
  }
}

findConnection().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

