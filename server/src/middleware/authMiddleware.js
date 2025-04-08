// Authentication & Authorization Middleware

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // User is logged in, proceed to the next middleware/route handler
    }
    // User is not logged in
    console.log('ensureAuthenticated: User not authenticated, redirecting to login.');
    // TODO: Decide if API should return 401/403 or redirect
    // For API endpoints, returning an error status is often better:
    // return res.status(401).json({ message: 'Authentication required.' }); 
    res.redirect('/login?message=login_required'); // For web pages, redirect to login
}

// Middleware factory to check if user has ALL specified roles
function ensureRole(requiredRoles) {
    if (!Array.isArray(requiredRoles)) {
        requiredRoles = [requiredRoles]; // Ensure it's an array
    }

    return (req, res, next) => {
        // First, ensure user is authenticated
        if (!req.isAuthenticated()) {
            console.log('ensureRole: User not authenticated.');
            return res.status(401).json({ message: 'Authentication required.' });
            // Or: res.redirect('/login?message=login_required');
        }

        // Check if user roles (fetched during deserialization) are available
        if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
            console.error('ensureRole: User object or user roles not found/invalid on req.user.');
            return res.status(403).json({ message: 'Forbidden: Role information missing.' });
            // Or redirect, or handle as appropriate
        }

        // Check if user has at least one of the required roles
        const hasRequiredRole = requiredRoles.some(role => req.user.roles.includes(role));

        if (hasRequiredRole) {
            return next(); // User has the required role, proceed
        } else {
            console.log(`ensureRole: Access denied. User roles: [${req.user.roles.join(', ')}], Required: [${requiredRoles.join(', ')}]`);
            // User does not have the required role
            // TODO: Decide how to respond - 403 Forbidden, redirect, custom error page?
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
            // Or: res.status(403).send('Access Denied');
            // Or: res.redirect('/unauthorized');
        }
    };
}

// Example usage in a route file:
// const { ensureAuthenticated, ensureRole } = require('../middleware/authMiddleware');
// router.get('/admin-only', ensureAuthenticated, ensureRole('Admin'), (req, res) => { ... });
// router.post('/matches', ensureAuthenticated, ensureRole(['Admin', 'Coach']), (req, res) => { ... });

module.exports = {
    ensureAuthenticated,
    ensureRole,
}; 