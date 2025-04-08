require('dotenv').config();
const express = require('express');
const teamRoutes = require('./src/backend/routes/teamRoutes');
const userRoutes = require('./src/backend/routes/userRoutes'); // Import user routes
const playerRoutes = require('./src/backend/routes/playerRoutes'); // Import player routes
const meetRoutes = require('./src/backend/routes/meetRoutes'); // Import meet routes

const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable for port or default to 3000

// Middleware
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/teams', teamRoutes); // Mount team routes under /api/teams
app.use('/api/users', userRoutes); // Mount user routes under /api/users
app.use('/api/players', playerRoutes); // Mount player routes under /api/players
app.use('/api/meets', meetRoutes); // Mount meet routes under /api/meets

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