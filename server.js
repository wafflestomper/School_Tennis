require('dotenv').config();
const express = require('express');
const teamRoutes = require('./src/backend/routes/teamRoutes');
const userRoutes = require('./src/backend/routes/userRoutes'); // Import user routes
const playerRoutes = require('./src/backend/routes/playerRoutes'); // Import player routes
const meetRoutes = require('./src/backend/routes/meetRoutes'); // Import meet routes
const roleRoutes = require('./src/backend/routes/roleRoutes'); // Import role routes
const seasonRoutes = require('./src/backend/routes/seasonRoutes'); // Import season routes
const matchRoutes = require('./src/backend/routes/matchRoutes'); // Import match routes
const setRoutes = require('./src/backend/routes/setRoutes'); // Import set routers (top-level and nested)

const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable for port or default to 3000

// Middleware
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/teams', teamRoutes); // Mount team routes under /api/teams
app.use('/api/users', userRoutes); // Mount user routes under /api/users
app.use('/api/players', playerRoutes); // Mount player routes under /api/players
app.use('/api/meets', meetRoutes); // Mount meet routes under /api/meets
app.use('/api/roles', roleRoutes); // Mount role routes under /api/roles
app.use('/api/seasons', seasonRoutes); // Mount season routes under /api/seasons

// Mount match routes
app.use('/api/matches', matchRoutes);

// Mount set routes
app.use('/api/sets', setRoutes.router); // Mount top-level set routes (/api/sets/:id)
app.use('/api/matches/:matchId/sets', setRoutes.nestedRouter); // Mount nested set routes

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