require('dotenv').config();

// Helper function to clean environment variables (remove \r, \n, and trim whitespace)
function cleanEnv(envVar, defaultValue) {
  if (!envVar) return defaultValue;
  return envVar.toString().replace(/\r\n/g, '\n').replace(/\r/g, '').trim();
}

module.exports = {
  database: {
    type: cleanEnv(process.env.DB_TYPE, 'postgres'), // 'postgres', 'mariadb', or 'mysql'
    host: cleanEnv(process.env.DB_HOST, 'localhost'),
    port: parseInt(cleanEnv(process.env.DB_PORT, process.env.DB_TYPE === 'mariadb' || process.env.DB_TYPE === 'mysql' ? '3306' : '5432'), 10),
    database: cleanEnv(process.env.DB_NAME, 'recepie_db'),
    user: cleanEnv(process.env.DB_USER, process.env.DB_TYPE === 'mariadb' || process.env.DB_TYPE === 'mysql' ? 'root' : 'postgres'),
    password: cleanEnv(process.env.DB_PASSWORD, 'MNOmno001'),
  },
  server: {
    port: parseInt(cleanEnv(process.env.PORT, '3000'), 10),
  },
  homeAssistant: {
    baseUrl: cleanEnv(process.env.HA_BASE_URL, ''),
    token: cleanEnv(process.env.HA_TOKEN, ''),
  },
};
