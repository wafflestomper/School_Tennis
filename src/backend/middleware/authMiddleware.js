/**
 * Middleware to ensure the user is authenticated.
 * If authenticated, proceeds to the next middleware/route handler.
 * If not authenticated, sends a 401 Unauthorized response.
 */
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        // isAuthenticated() is provided by Passport
        return next();
    }
    // If not authenticated
    console.log('Auth Middleware: User not authenticated, blocking request to:', req.originalUrl);
    res.status(401).json({ message: 'Unauthorized: Access requires login' });
};

/**
 * Optional: Middleware to ensure the user has a specific role (or roles).
 * Example: ensureAdmin
 * @param {Array<string>|string} requiredRoles - The role name(s) required.
 */
// const ensureRole = (requiredRoles) => {
//     const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
//     return (req, res, next) => {
//         if (!req.isAuthenticated()) {
//             return res.status(401).json({ message: 'Unauthorized: Access requires login' });
//         }
//         // Assumes req.user contains role information (e.g., req.user.role_name or req.user.role_id)
//         // You might need to join with the roles table in deserializeUser to get the role name
//         const userRole = req.user.role_name; // Adjust based on your req.user structure
//         if (userRole && roles.includes(userRole)) {
//             return next();
//         } else {
//             console.log(`Auth Middleware: User ${req.user.email} lacks required role(s): ${roles.join(', ')}`);
//             return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
//         }
//     };
// };

module.exports = {
    ensureAuthenticated,
    // ensureRole // Uncomment and adapt if role-based access is needed
}; 