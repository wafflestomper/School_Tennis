const express = require('express');
const userService = require('../services/userService');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/users - Create a new user
router.post('/', async (req, res, next) => {
    try {
        // Add input validation here (e.g., check email format, role_id is int)
        const { email, name, role_id, google_id } = req.body;
        if (!email || !name || !role_id) {
            return res.status(400).json({ message: 'Missing required fields: email, name, role_id' });
        }
        // Basic role_id validation (assuming roles 1-4 exist from seeding)
        if (!Number.isInteger(role_id) || role_id < 1 || role_id > 4) {
             return res.status(400).json({ message: 'Invalid role_id. Must be an integer between 1 and 4.' });
        }

        const newUser = await userService.createUser(req.body);
        res.status(201).json(newUser);
    } catch (err) {
        console.error('Error in POST /users route:', err);
        if (err.message.includes('already exists')) {
             res.status(409).json({ message: err.message }); // 409 Conflict
        } else if (err.message.includes('Missing required fields')) {
             res.status(400).json({ message: err.message });
        } else {
             res.status(500).json({ message: 'Error creating user' });
        }
    }
});

// GET /api/users - Get all users
router.get('/', async (req, res, next) => {
    try {
        const users = await userService.getAllUsers();
        res.json(users);
    } catch (err) {
        console.error('Error in GET /users route:', err);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// GET /api/users/:id - Get a single user by ID
router.get('/:id', async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        const user = await userService.getUserById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error in GET /users/:id route:', err);
        res.status(500).json({ message: 'Error fetching user' });
    }
});

// PUT /api/users/:id - Update a user
router.put('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Add more specific input validation if needed (e.g., email format)
        const { email, name, role_id, google_id } = req.body;
         if (email === undefined && name === undefined && role_id === undefined && google_id === undefined) {
            return res.status(400).json({ message: 'No update fields provided' });
        }
        // Basic role_id validation if provided
         if (role_id !== undefined && (!Number.isInteger(role_id) || role_id < 1 || role_id > 4)) {
             return res.status(400).json({ message: 'Invalid role_id. Must be an integer between 1 and 4.' });
        }

        const updatedUser = await userService.updateUser(userId, req.body);
        if (!updatedUser) {
            // This check might be redundant if updateUser throws for not found ID, but safe to keep
             return res.status(404).json({ message: 'User not found' });
        }
        res.json(updatedUser);
    } catch (err) {
        console.error('Error in PUT /users/:id route:', err);
        if (err.message.includes('already in use')) {
             res.status(409).json({ message: err.message });
        } else {
             res.status(500).json({ message: 'Error updating user' });
        }
    }
});


// DELETE /api/users/:id - Delete a user
router.delete('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        const deletedUser = await userService.deleteUser(userId);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(deletedUser); // Return basic info of deleted user
    } catch (err) {
        console.error('Error in DELETE /users/:id route:', err);
        // Foreign key constraint errors (if schema used RESTRICT) are less likely here
        // due to ON DELETE SET NULL/CASCADE, but could happen in other scenarios.
         res.status(500).json({ message: 'Error deleting user' });
    }
});

module.exports = router; 