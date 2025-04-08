const express = require('express');
const {
    createMatch,
    getAllMatches,
    getMatchById,
    updateMatch,
    deleteMatch
} = require('../services/matchService');
const setService = require('../services/setService'); // Needed for fetching sets when getting a match
const { ensureAuthenticated } = require('../middleware/authMiddleware'); // Import

const router = express.Router();

// POST /api/matches - Create a new match (Protected)
router.post('/', ensureAuthenticated, async (req, res, next) => {
    try {
        // Add more specific validation here based on line_type, player assignments, etc.
        const newMatch = await createMatch(req.body);
        res.status(201).json(newMatch);
    } catch (err) {
        console.error('Error in POST /matches route:', err);
        if (err.message.includes('Missing required') || err.message.includes('Invalid') || err.message.includes('Foreign key') || err.message.includes('Check constraint')) {
            return res.status(400).json({ message: err.message });
        }
        if (err.message.includes('already exists')) {
             return res.status(409).json({ message: err.message });
        }
        res.status(500).json({ message: err.message || 'Error creating match' });
    }
});

// GET /api/matches - Get all matches (Public)
router.get('/', async (req, res, next) => {
    try {
        const filters = {};
        if (req.query.meet_id) {
             const meetId = parseInt(req.query.meet_id, 10);
             if (isNaN(meetId)) {
                 return res.status(400).json({ message: 'Invalid meet_id format' });
             }
             filters.meet_id = meetId;
        }
        // Consider adding option to include sets data? (e.g., ?include=sets)
        const matches = await getAllMatches(filters);
        res.json(matches);
    } catch (err) {
        console.error('Error in GET /matches route:', err);
        res.status(500).json({ message: err.message || 'Error fetching matches' });
    }
});

// GET /api/matches/:id - Get a single match by ID (Public)
router.get('/:id', async (req, res, next) => {
    try {
        const matchId = parseInt(req.params.id, 10);
        if (isNaN(matchId)) {
            return res.status(400).json({ message: 'Invalid match ID format' });
        }
        const match = await getMatchById(matchId);
        if (!match) {
            return res.status(404).json({ message: 'Match not found' });
        }
        // Fetch associated sets
        const sets = await setService.getSetsByMatchId(matchId);
        match.sets = sets; // Embed sets data in the response

        res.json(match);
    } catch (err) {
        console.error('Error in GET /matches/:id route:', err);
        res.status(500).json({ message: err.message || 'Error fetching match details' });
    }
});

// PUT /api/matches/:id - Update a match (Protected)
router.put('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        const matchId = parseInt(req.params.id, 10);
        if (isNaN(matchId)) {
            return res.status(400).json({ message: 'Invalid match ID format' });
        }
        // Add validation for update data
        const updateData = req.body;
         if (Object.keys(updateData).length === 0) {
             return res.status(400).json({ message: 'No update fields provided' });
         }

        const updatedMatch = await updateMatch(matchId, updateData);
        if (!updatedMatch) {
            return res.status(404).json({ message: 'Match not found' });
        }
        res.json(updatedMatch);
    } catch (err) {
        console.error('Error in PUT /matches/:id route:', err);
         if (err.message.includes('Invalid') || err.message.includes('Foreign key') || err.message.includes('Check constraint')) {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: err.message || 'Error updating match' });
    }
});

// DELETE /api/matches/:id - Delete a match (and its sets) (Protected)
router.delete('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        const matchId = parseInt(req.params.id, 10);
        if (isNaN(matchId)) {
            return res.status(400).json({ message: 'Invalid match ID format' });
        }
        const deletedMatch = await deleteMatch(matchId);
        if (!deletedMatch) {
            return res.status(404).json({ message: 'Match not found' });
        }
        res.json(deletedMatch); // Return deleted match data
    } catch (err) {
        console.error('Error in DELETE /matches/:id route:', err);
        res.status(500).json({ message: err.message || 'Error deleting match' });
    }
});

module.exports = router; 