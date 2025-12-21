// Simple direct connection test
require('dotenv').config();
const mysql = require('mysql2/promise');

const connectionConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

console.log('Testing connection with:');
console.log('  Host:', connectionConfig.host);
console.log('  Port:', connectionConfig.port);
console.log('  User:', connectionConfig.user);
console.log('  Database:', connectionConfig.database);
console.log('');

mysql.createConnection(connectionConfig)
  .then(connection => {
    console.log('✅ Connection successful!');
    return connection.query('SELECT DATABASE() as db, VERSION() as version');
  })
  .then(([rows]) => {
    console.log('Database:', rows[0].db);
    console.log('Version:', rows[0].version);
    console.log('');
    console.log('✅ Your connection settings are correct!');
    console.log('You can now run: node scripts/populate-poultry.js --dry-run');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Please verify:');
    console.error('  1. The port number in .env matches what you used manually');
    console.error('  2. Try changing DB_PORT in .env to 3306 (default MariaDB port)');
    console.error('  3. Check if MariaDB is listening on the expected port');
    process.exit(1);
  });

