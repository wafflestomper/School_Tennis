const { Pool } = require('pg');
require('dotenv').config();

// Explicitly pass the connection string from the environment variable
const connectionString = process.env.DATABASE_URL;

// Log the loaded DATABASE_URL to verify
console.log('Attempting to use DATABASE_URL:', connectionString);

if (!connectionString) {
  console.error('FATAL ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1); // Exit if the database URL is not found
}

const pool = new Pool({
  connectionString: connectionString,
});

// Optional: Add a connection test
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release(); // Release the client back to the pool
    if (err) {
      return console.error('Error executing query', err.stack);
    }
    console.log('Connected to database via DATABASE_URL!'); // Modified log message
  });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}; 