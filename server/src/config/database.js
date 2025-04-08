// PostgreSQL Database Connection Configuration

const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' }); // Ensure .env is loaded relative to this file

// Check if essential database environment variables are set
if (!process.env.DATABASE_URL && (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_HOST || !process.env.DB_PORT || !process.env.DB_NAME)) {
    console.error('ERROR: Database connection details missing in .env file.');
    console.error('Please provide either DATABASE_URL or individual DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME.');
    process.exit(1); // Exit if database configuration is missing
}

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        // Add SSL configuration for production environments if needed
        // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      };

const pool = new Pool(poolConfig);

// Optional: Test the connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Database connection successful.');
    client.query('SELECT NOW()', (err, result) => {
        release(); // Release the client back to the pool
        if (err) {
            return console.error('Error executing query', err.stack);
        }
        console.log('Current time from DB:', result.rows[0].now);
    });
});

// Export a query function to easily run queries from other modules
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool, // Export the pool itself if direct access is needed
}; 