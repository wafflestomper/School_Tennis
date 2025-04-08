// Passport.js Configuration

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database'); // Use our database query helper
const bcrypt = require('bcrypt'); // Needed if implementing local strategy later
require('dotenv').config({ path: '../../.env' });

// --- User Helper Functions (Interact with Database) --- 

// Find user by ID (used for deserialization)
async function findUserById(id) {
    try {
        const result = await db.query('SELECT * FROM users WHERE user_id = $1', [id]);
        return result.rows[0];
    } catch (err) {
        console.error('Error finding user by ID:', err);
        return null;
    }
}

// Find user by Google ID
async function findUserByGoogleId(googleId) {
    try {
        const result = await db.query('SELECT * FROM users WHERE google_sso_id = $1', [googleId]);
        return result.rows[0];
    } catch (err) {
        console.error('Error finding user by Google ID:', err);
        return null;
    }
}

// Find or create user based on Google profile
async function findOrCreateGoogleUser(profile) {
    const googleId = profile.id;
    let user = await findUserByGoogleId(googleId);

    if (user) {
        // Update user info if necessary (e.g., name change)
        // Optional: Add logic here to update first/last name if they differ
        return user;
    } else {
        // User not found, create a new one
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const firstName = profile.name ? profile.name.givenName : ''
        const lastName = profile.name ? profile.name.familyName : ''

        if (!email) {
            console.error('Google profile did not return an email address. Cannot create user.');
            return null; // Or handle differently - maybe prompt user for email?
        }

        // Check if email already exists from a different login method
        try {
            const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (emailCheck.rows.length > 0) {
                // Email exists, potentially link Google ID to existing account?
                // For now, we'll prevent creation to avoid duplicates. Handle this case as needed.
                console.warn(`User with email ${email} already exists. Google SSO login failed for Google ID ${googleId}.`);
                // TODO: Implement account linking logic if desired
                return null;
            }
        } catch (err) {
            console.error('Error checking for existing email:', err);
            return null;
        }

        // Create new user
        try {
            const insertResult = await db.query(
                'INSERT INTO users (email, first_name, last_name, google_sso_id, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [email, firstName, lastName, googleId, true]
            );
            console.log('New Google user created:', insertResult.rows[0]);
            // TODO: Assign default role(s) to the new user? (e.g., 'Public' or trigger admin approval?)
            // Example: await db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, (SELECT role_id FROM roles WHERE role_name = $2))', [insertResult.rows[0].user_id, 'Public']);
            return insertResult.rows[0];
        } catch (err) {
            console.error('Error creating new Google user:', err);
            return null;
        }
    }
}

// --- Passport Configuration --- 

module.exports = function(passport) {

    // Serialize user ID into the session
    passport.serializeUser((user, done) => {
        done(null, user.user_id); // Store only the user ID in the session
    });

    // Deserialize user from the session using the ID
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await findUserById(id);
            // TODO: Potentially fetch user roles here as well and attach to user object
            // const rolesResult = await db.query('SELECT r.role_name FROM roles r JOIN user_roles ur ON r.role_id = ur.role_id WHERE ur.user_id = $1', [id]);
            // if (user) user.roles = rolesResult.rows.map(r => r.role_name);
            done(null, user); // User object attached to req.user
        } catch (err) {
            done(err, null);
        }
    });

    // Google OAuth 2.0 Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'] // Request access to profile and email
    },
    async (accessToken, refreshToken, profile, done) => {
        // This function is called when Google redirects back to your callback URL
        console.log('Google profile received:', profile);

        try {
            const user = await findOrCreateGoogleUser(profile);
            if (!user) {
                // Handle case where user couldn't be found or created
                return done(null, false, { message: 'Failed to login/register with Google.' });
            }
            return done(null, user); // Success! Pass user object to Passport
        } catch (err) {
            console.error('Error during Google strategy verification:', err);
            return done(err, false);
        }
    }
    ));

    // TODO: Add Local Strategy (Username/Password) if needed
    // passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => { ... }));
}; 