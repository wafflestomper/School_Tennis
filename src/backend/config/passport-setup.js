const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const userService = require('../services/userService'); // Assuming user service has necessary functions
const db = require('../db'); // Or directly use userService

// --- User Serialization/Deserialization ---
// Determines what user information is stored in the session

// Called when a user is authenticated. Stores user.id in the session.
passport.serializeUser((user, done) => {
    done(null, user.id); // Store only the user ID in the session
});

// Called on subsequent requests to retrieve user data from the session ID.
passport.deserializeUser(async (id, done) => {
    try {
        // Fetch user from database using the ID stored in the session, joining with roles
        const queryText = `
            SELECT u.id, u.google_id, u.email, u.name, u.role_id, r.name as role_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1;
        `;
        const result = await db.query(queryText, [id]);
        const user = result.rows[0];
        if (!user) {
            return done(null, false, { message: 'User not found' }); // User not found
        }
        done(null, user); // Attach the user object to req.user
    } catch (err) {
        done(err, null);
    }
});

// --- Local Strategy (Email/Password) ---
passport.use(new LocalStrategy(
    { usernameField: 'email' }, // Tell LocalStrategy to use 'email' as the username field
    async (email, password, done) => {
        try {
             // 1. Find user by email (using userService or db)
             const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
             const user = userResult.rows[0];

             if (!user) {
                return done(null, false, { message: 'Incorrect email or password.' });
            }

             // 2. Check if the user has a local password set (they might be Google-only user)
            if (!user.password) {
                 return done(null, false, { message: 'Please log in using your original method (e.g., Google).' });
            }

             // 3. Compare provided password with the stored hash
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                 const { password: _, ...userWithoutPassword } = user;
                 return done(null, userWithoutPassword);
            } else {
                 return done(null, false, { message: 'Incorrect email or password.' });
            }
        } catch (err) {
            done(err);
        }
    }
));

// --- Google OAuth 2.0 Strategy ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email'] // Request user's profile and email
    },
    async (accessToken, refreshToken, profile, done) => {
        // This function is called after Google redirects back to /auth/google/callback
        const googleId = profile.id;
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        const name = profile.displayName;

        if (!email) {
            return done(new Error('Email not provided by Google.'), null);
        }

        try {
             // 1. Find user by Google ID
             let userResult = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
             let user = userResult.rows[0];

            if (user) {
                // User found by Google ID - Log them in
                 const { password: _, ...userWithoutPassword } = user;
                 return done(null, userWithoutPassword);
            } else {
                 // User NOT found by Google ID - Check if email exists (maybe they signed up locally first)
                 userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
                 user = userResult.rows[0];

                 if (user) {
                     // User found by email - Link Google ID to existing account
                     // Update the user record with their Google ID
                     const updateResult = await db.query(
                         'UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                         [googleId, user.id]
                     );
                     user = updateResult.rows[0];
                      const { password: _, ...userWithoutPassword } = user;
                     return done(null, userWithoutPassword);
                 } else {
                     // User not found by Google ID or email - Create a new user
                     // Assign a default role (e.g., 'Player') - needs lookup or hardcoding
                     // Ideally, fetch role ID from roles table
                     const defaultRoleResult = await db.query("SELECT id FROM roles WHERE name = 'Player'");
                     const defaultRoleId = defaultRoleResult.rows[0]?.id || 3; // Fallback to ID 3 if 'Player' role not found

                     const newUserResult = await db.query(
                         'INSERT INTO users (google_id, email, name, role_id, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
                         [googleId, email, name, defaultRoleId]
                     );
                     user = newUserResult.rows[0];
                     return done(null, user);
                 }
             }
         } catch (err) {
            done(err, null);
         }
    }
));

// Note: We are not exporting anything from this file.
// Its purpose is to configure Passport, which is then used by the middleware in server.js.
// Ensure this file is required once in server.js after passport is imported. 