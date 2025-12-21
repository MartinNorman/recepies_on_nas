require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
  console.log('Connecting with:');
  console.log('Host:', process.env.DB_HOST);
  console.log('Port:', process.env.DB_PORT);
  console.log('Database:', process.env.DB_NAME);
  console.log('User:', process.env.DB_USER);
  console.log('Password:', process.env.DB_PASSWORD);
  
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    
    const [rows] = await pool.execute('SELECT 1 as test');
    console.log('SUCCESS! Connected to database');
    console.log('Result:', rows);
    await pool.end();
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

test();
