// Authentication Routes (Google SSO, Logout)

const express = require('express');
const passport = require('passport');
const router = express.Router();

// --- Google OAuth Routes --- 

// 1. Route to start the Google authentication flow
//    Clicking a "Login with Google" button should link here.
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'] // Ensure we request profile and email
}));

// 2. Google callback route
//    Google redirects here after user grants permission.
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login?error=google_failed', // Redirect on failure (e.g., user denied access)
        // successRedirect: '/', // Redirect on successful authentication - could go to dashboard
        // failureMessage: true // store failure message in req.session.messages
    }),
    (req, res) => {
        // Successful authentication!
        console.log('Google authentication successful, user:', req.user);
        // Redirect to a logged-in area, like a dashboard or profile page.
        // TODO: Implement role-based redirects?
        res.redirect('/profile'); // Example: Redirect to a profile page (needs to be created)
    }
);

// --- Logout Route --- 

router.get('/logout', (req, res, next) => {
    req.logout((err) => { // req.logout requires a callback
        if (err) {
            console.error('Error during logout:', err);
            return next(err);
        }
        req.session.destroy((err) => { // Destroy the session data
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            console.log('User logged out and session destroyed.');
            res.redirect('/'); // Redirect to homepage after logout
        });
    });
});

// --- Get User Status --- 

// API endpoint for frontend to check if user is logged in
router.get('/status', (req, res) => {
    if (req.isAuthenticated()) {
        // If authenticated, send back some basic user info (avoid sending sensitive data)
        // TODO: Add user roles here once fetched during deserialization
        res.json({
            isLoggedIn: true,
            user: {
                id: req.user.user_id,
                firstName: req.user.first_name,
                lastName: req.user.last_name,
                email: req.user.email,
                // roles: req.user.roles || [] // Include roles if available
            }
        });
    } else {
        res.json({ isLoggedIn: false });
    }
});

module.exports = router; 