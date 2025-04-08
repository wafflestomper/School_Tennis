require('dotenv').config();
const express = require('express');
const teamRoutes = require('./src/backend/routes/teamRoutes');

const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable for port or default to 3000

// Middleware
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/teams', teamRoutes); // Mount team routes under /api/teams

// Basic error handler (can be expanded)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app; // Export app for potential testing 