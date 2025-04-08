const express = require('express');
const {
    createSet,
    getSetsByMatchId,
    getSetById,
    updateSet,
    deleteSet
} = require('../services/setService');
const matchService = require('../services/matchService'); // To verify match exists

// Create separate routers for top-level and nested routes
const router = express.Router(); // For /api/sets/:id routes
const nestedRouter = express.Router({ mergeParams: true }); // For /api/matches/:matchId/sets routes

// --- Nested Routes (/api/matches/:matchId/sets) ---

// Middleware to validate matchId for nested routes
nestedRouter.use(async (req, res, next) => {
    const matchId = parseInt(req.params.matchId, 10);
    if (isNaN(matchId)) {
        return res.status(400).json({ message: 'Invalid match ID format in URL' });
    }
    // Check if match exists before proceeding
    const match = await matchService.getMatchById(matchId);
    if (!match) {
        return res.status(404).json({ message: `Match with ID ${matchId} not found` });
    }
    req.matchId = matchId; // Attach validated matchId to request object
    next();
});

// GET /api/matches/:matchId/sets - Get all sets for a specific match
nestedRouter.get('/', async (req, res, next) => {
    try {
        const sets = await getSetsByMatchId(req.matchId);
        res.json(sets);
    } catch (err) {
        console.error(`Error in GET /matches/${req.matchId}/sets route:`, err);
        res.status(500).json({ message: err.message || 'Error fetching sets for match' });
    }
});

// POST /api/matches/:matchId/sets - Create a new set for a specific match
nestedRouter.post('/', async (req, res, next) => {
    try {
        // Add validation for set data (e.g., scores)
        const setData = { ...req.body, match_id: req.matchId }; // Inject match_id from URL param
        const newSet = await createSet(setData);
        res.status(201).json(newSet);
    } catch (err) {
        console.error(`Error in POST /matches/${req.matchId}/sets route:`, err);
        if (err.message.includes('Missing required') || err.message.includes('Invalid') || err.message.includes('Foreign key') || err.message.includes('Check constraint')) {
            return res.status(400).json({ message: err.message });
        }
         if (err.message.includes('already exists')) {
            return res.status(409).json({ message: err.message });
        }
        res.status(500).json({ message: err.message || 'Error creating set for match' });
    }
});

// --- Top-Level Routes (/api/sets/:id) ---
// These operate directly on a set ID, independent of the match context in the URL

// GET /api/sets/:id - Get a single set by its ID
router.get('/:id', async (req, res, next) => {
    try {
        const setId = parseInt(req.params.id, 10);
        if (isNaN(setId)) {
            return res.status(400).json({ message: 'Invalid set ID format' });
        }
        const set = await getSetById(setId);
        if (!set) {
            return res.status(404).json({ message: 'Set not found' });
        }
        res.json(set);
    } catch (err) {
        console.error('Error in GET /sets/:id route:', err);
        res.status(500).json({ message: err.message || 'Error fetching set' });
    }
});

// PUT /api/sets/:id - Update a set by its ID
router.put('/:id', async (req, res, next) => {
    try {
        const setId = parseInt(req.params.id, 10);
        if (isNaN(setId)) {
            return res.status(400).json({ message: 'Invalid set ID format' });
        }
        // Add validation for update data
         const updateData = req.body;
         if (Object.keys(updateData).length === 0) {
             return res.status(400).json({ message: 'No update fields provided' });
         }
         // Cannot update match_id or set_number via this route
         if (updateData.match_id !== undefined || updateData.set_number !== undefined) {
             return res.status(400).json({ message: 'Cannot update match_id or set_number via this endpoint.' });
         }

        const updatedSet = await updateSet(setId, updateData);
        if (!updatedSet) {
            return res.status(404).json({ message: 'Set not found' });
        }
        res.json(updatedSet);
    } catch (err) {
        console.error('Error in PUT /sets/:id route:', err);
         if (err.message.includes('Check constraint')) {
             return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: err.message || 'Error updating set' });
    }
});

// DELETE /api/sets/:id - Delete a set by its ID
router.delete('/:id', async (req, res, next) => {
    try {
        const setId = parseInt(req.params.id, 10);
        if (isNaN(setId)) {
            return res.status(400).json({ message: 'Invalid set ID format' });
        }
        const deletedSet = await deleteSet(setId);
        if (!deletedSet) {
            return res.status(404).json({ message: 'Set not found' });
        }
        res.json(deletedSet);
    } catch (err) {
        console.error('Error in DELETE /sets/:id route:', err);
        res.status(500).json({ message: err.message || 'Error deleting set' });
    }
});


// Export both routers
module.exports = { router, nestedRouter }; 