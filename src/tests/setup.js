// src/tests/setup.js
const fs = require('fs');
const path = require('path');
const db = require('../backend/db'); // Import the configured db

// List of tables to clean before each test, in reverse dependency order
const tablesToClean = [
  'stats',      // References matches, players
  'sets',       // References matches
  'matches',    // References meets, players
  'players',    // References users, teams
  'meets',      // References seasons, teams, meet_formats
  'teams',      // References users
  'users',      // References roles
  'meet_formats',// References users
  'seasons'     // No references (in this list)
  // 'roles' table is intentionally omitted as it contains static seeded data
];

// Function to execute the schema SQL file
const runSchema = async () => {
  try {
    // Adjust path if your schema.sql is located elsewhere
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running schema.sql on test database...');
    await db.pool.query(schemaSql);
    console.log('Schema applied successfully.');
  } catch (error) {
    console.error('Error applying schema.sql:', error);
    // Optionally exit if schema fails
    process.exit(1);
  }
};

// Function to clean tables
const cleanTables = async () => {
  // console.log('Cleaning test database tables...'); // Removed log
  // Use TRUNCATE CASCADE with the correct table order
  try {
    for (const table of tablesToClean) {
      // console.log(`  Truncating ${table}...`); // Removed log
      await db.pool.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    }
    // console.log('Tables cleaned.'); // Removed log
  } catch (error) {
    console.error('Error cleaning tables:', error);
    throw error; // Re-throw error to make sure test run knows cleaning failed
  }
};

// Run before all tests in the suite
beforeAll(async () => {
  console.log('Running setup before all tests...');
  // Ensure test database schema is set up
  await runSchema();
});

// Run after all tests in the suite (actually, after all tests in the *file*)
afterAll(async () => {
  console.log('Running teardown after all tests in file...');
  // Attempt to close the pool here
  try {
    await db.pool.end();
    console.log('Database pool closed.');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
});

// Export cleanTables for use in test files
module.exports = { cleanTables };