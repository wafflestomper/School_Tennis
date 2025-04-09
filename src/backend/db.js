const { Pool } = require('pg');
require('dotenv').config();

// Determine connection string based on NODE_ENV
const isTest = process.env.NODE_ENV === 'test';
const connectionString = isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

// Log which environment and connection string is being used
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Using ${isTest ? 'Test' : 'Development/Production'} Database URL: ${connectionString}`);

if (!connectionString) {
  console.error(`FATAL ERROR: ${isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL'} environment variable is not set.`);
  process.exit(1); // Exit if the required database URL is not found
}

const pool = new Pool({
  connectionString: connectionString,
});

// Optional: Remove or conditionalize the immediate connection test if noisy during tests
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release(); // Release the client back to the pool
    if (err) {
      return console.error('Error executing query', err.stack);
    }
    // Only log connection success outside of test environment to reduce noise
    if (!isTest) {
        console.log(`Connected to database via ${isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL'}!`);
    }
  });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}; 