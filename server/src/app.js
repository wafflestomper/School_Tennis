// Main Express application configuration

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
// const pg = require('pg'); // No longer needed directly here
const connectPgSimple = require('connect-pg-simple');

// Import database connection setup
const { pool } = require('./config/database'); // Import the configured pool

// Import and configure passport
require('./config/passport')(passport); // Pass passport instance to config function

const app = express();

// --- Middleware --- 

// Body Parsing
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Session Configuration
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
    pool: pool, // Use the imported database pool
    // conString: process.env.DATABASE_URL, // Pool handles connection details
    tableName: 'user_sessions', // Optional: specify session table name
    createTableIfMissing: true, // Automatically create session table
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true, // Prevent client-side JS from reading the cookie
        // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        sameSite: 'lax' // Protect against CSRF
    }
}));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// Serve Static Files (CSS, JS, images from client folder)
// Assuming 'client' directory is one level up from 'server/src'
const clientPath = path.join(__dirname, '../../client');
app.use(express.static(clientPath));

// --- Routes --- 

// Mount authentication routes
app.use('/auth', require('./routes/auth'));

// Mount API routes
app.use('/api/teams', require('./routes/teams'));
// TODO: Define other API routes (e.g., /api/matches, /api/players)
// app.use('/api/users', require('./routes/users'));

// Basic root route (sends the main HTML file)
app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// TODO: Add specific routes for pages like /login, /teams/:id, etc.
// These might serve the index.html and let client-side routing handle the view,
// or they could serve specific server-rendered templates if not using a SPA.

// --- Error Handling --- 
// TODO: Add basic error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app; 