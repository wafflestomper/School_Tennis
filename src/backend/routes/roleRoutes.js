const express = require('express');
const {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
} = require('../services/roleService'); // Import all service functions
const { ensureAuthenticated } = require('../middleware/authMiddleware'); // Import

const router = express.Router();

// GET /api/roles - Get all roles
router.get('/', async (req, res, next) => {
    try {
        const roles = await getAllRoles();
        res.json(roles);
    } catch (err) {
        console.error('Error in GET /roles route:', err);
        // Pass error to a central error handler if implemented, otherwise send 500
        res.status(500).json({ message: err.message || 'Error fetching roles' });
        // Alternatively: next(err);
    }
});

// GET /api/roles/:id - Get a single role by ID
router.get('/:id', async (req, res, next) => {
    try {
        const roleId = parseInt(req.params.id, 10);
        if (isNaN(roleId)) {
            return res.status(400).json({ message: 'Invalid role ID format' });
        }
        const role = await getRoleById(roleId);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }
        res.json(role);
    } catch (err) {
        console.error('Error in GET /roles/:id route:', err);
        res.status(500).json({ message: err.message || 'Error fetching role' });
        // Alternatively: next(err);
    }
});

// POST /api/roles - Create a new role
router.post('/', ensureAuthenticated, async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Missing required field: name' });
        }
        const newRole = await createRole(req.body);
        res.status(201).json(newRole);
    } catch (err) {
        console.error('Error in POST /roles route:', err);
        if (err.message.includes('already exists')) {
            return res.status(409).json({ message: err.message }); // Conflict
        }
        if (err.message.includes('Missing required field')) {
             return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: err.message || 'Error creating role' });
        // Alternatively: next(err);
    }
});

// PUT /api/roles/:id - Update a role
router.put('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        const roleId = parseInt(req.params.id, 10);
        if (isNaN(roleId)) {
            return res.status(400).json({ message: 'Invalid role ID format' });
        }
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Missing required field for update: name' });
        }

        const updatedRole = await updateRole(roleId, req.body);
        if (!updatedRole) {
            return res.status(404).json({ message: 'Role not found' });
        }
        res.json(updatedRole);
    } catch (err) {
        console.error('Error in PUT /roles/:id route:', err);
        if (err.message.includes('already exists')) {
             return res.status(409).json({ message: err.message }); // Conflict
        }
        res.status(500).json({ message: err.message || 'Error updating role' });
        // Alternatively: next(err);
    }
});

// DELETE /api/roles/:id - Delete a role
router.delete('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        const roleId = parseInt(req.params.id, 10);
        if (isNaN(roleId)) {
            return res.status(400).json({ message: 'Invalid role ID format' });
        }
        const deletedRole = await deleteRole(roleId);
        if (!deletedRole) {
            return res.status(404).json({ message: 'Role not found' });
        }
        res.json(deletedRole); // Return the deleted role data
    } catch (err) {
        console.error('Error in DELETE /roles/:id route:', err);
        if (err.message.includes('referenced by users')) {
            // Specific error from our service layer check
            return res.status(409).json({ message: err.message }); // Conflict
        }
        res.status(500).json({ message: err.message || 'Error deleting role' });
        // Alternatively: next(err);
    }
});

module.exports = router; 