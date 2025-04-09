const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const userService = require('../services/userService');

const router = express.Router();

// POST /api/auth/register - Local User Registration
router.post('/register', async (req, res, next) => {
    const { email, name, password, role_id } = req.body;

    // Basic Input Validation
    if (!email || !name || !password || !role_id) {
        return res.status(400).json({ message: 'Missing required fields: email, name, password, role_id' });
    }
    if (password.length < 6) { // Example minimum password length
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }
    // Add more validation: email format, role_id is valid integer, etc.

    try {
        // createUser in userService handles hashing and checks for existing email/google_id
        const newUser = await userService.createUser({ email, name, password, role_id });
        // Log the user in immediately after registration using req.login (provided by Passport)
        req.login(newUser, (err) => {
            if (err) {
                 console.error('Error logging in after registration:', err);
                 return next(err);
            }
            return res.status(201).json(newUser);
        });
    } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('Role with ID')) {
             return res.status(409).json({ message: err.message }); // Conflict or Bad Request
        }
        res.status(500).json({ message: err.message || 'Error registering user' });
    }
});

// POST /api/auth/login - Local User Login
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Error during local authentication:', err);
            return next(err);
        }
        if (!user) {
             console.log('Local authentication failed:', info ? info.message : 'No user returned');
             // info.message comes from the 'done(null, false, { message: ... })' in LocalStrategy
             return res.status(401).json({ message: info ? info.message : 'Authentication failed' });
        }
        // Log the user in - Passport attaches user to session
        req.login(user, (err) => {
            if (err) {
                console.error('Error establishing session after login:', err);
                return next(err);
            }
             return res.json(user);
        });
    })(req, res, next); // Important: call the middleware function returned by passport.authenticate
});

// GET /api/auth/google - Initiate Google OAuth Flow
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback - Google OAuth Callback Handler
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }), // Redirect to a login page on failure
    (req, res) => {
        // Successful authentication!
        console.log('Google authentication successful, user:', req.user);
        // Redirect to the frontend application, perhaps a dashboard page.
        // In a real app, you'd redirect to your frontend URL, e.g., process.env.FRONTEND_URL
        res.redirect('/'); // Redirect to homepage for now
    }
);

// POST /api/auth/logout - User Logout
router.post('/logout', (req, res, next) => {
     if (!req.user) {
         return res.status(401).json({ message: 'Not logged in' });
     }
     const userEmail = req.user.email;
     req.logout((err) => {
         if (err) {
             console.error('Error during logout:', err);
             return next(err);
         }
         // Optional: Clear session cookie explicitly if needed, though req.logout often handles this
         // req.session.destroy((err) => { ... });
         res.status(200).json({ message: 'Logged out successfully' });
     });
 });

// GET /api/auth/status - Check Login Status
router.get('/status', (req, res) => {
    if (req.isAuthenticated()) {
        // Send back the currently logged-in user's info (req.user is populated by Passport)
        res.json(req.user);
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});


module.exports = router; 