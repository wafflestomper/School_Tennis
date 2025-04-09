// src/tests/setup.js
const fs = require('fs');
const path = require('path');
const db = require('../backend/db'); // Import the configured db

// List of tables to clean before each test
// Only include tables holding transactional data, not static reference data like roles.
const tablesToClean = [
  'sets',
  'matches',
  'meets',
  'players',
  'teams',
  // 'sessions', // Removed as it's not defined in schema.sql
  'users',
  // 'roles', // Removed - Roles should persist as seeded by schema.sql
  'stats',
  'meet_formats',
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
  console.log('Cleaning test database tables...');
  try {
    for (const table of tablesToClean) {
      // Use TRUNCATE ... RESTART IDENTITY CASCADE for efficiency and resetting sequences
      await db.pool.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    }
    console.log('Tables cleaned.');
  } catch (error) {
    console.error('Error cleaning tables:', error);
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