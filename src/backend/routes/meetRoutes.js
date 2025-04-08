const express = require('express');
const meetService = require('../services/meetService');

const router = express.Router();

// POST /api/meets - Create a new meet
router.post('/', async (req, res, next) => {
    try {
         // Add more specific validation (e.g., date format, integer IDs)
         const { meet_date, team1_id, team2_id, meet_format_id } = req.body;
         if (!meet_date || !team1_id || !team2_id || !meet_format_id) {
            return res.status(400).json({ message: 'Missing required fields: meet_date, team1_id, team2_id, meet_format_id' });
        }
        if (team1_id === team2_id) {
             return res.status(400).json({ message: 'team1_id and team2_id cannot be the same.' });
        }
         // TODO: Validate that team1_id, team2_id, format_id, season_id (if provided) exist

        const newMeet = await meetService.createMeet(req.body);
        res.status(201).json(newMeet);
    } catch (err) {
        console.error('Error in POST /meets route:', err);
         if (err.message.includes('does not exist') || err.message.includes('Foreign key constraint violation')) {
            res.status(400).json({ message: err.message }); // Bad request due to non-existent FK
        } else if (err.message.includes('Missing required fields') || err.message.includes('cannot be the same')) {
            res.status(400).json({ message: err.message });
        } else {
            res.status(500).json({ message: 'Error creating meet' });
        }
    }
});

// GET /api/meets - Get all meets (optionally filter by season or team)
router.get('/', async (req, res, next) => {
    try {
        const filters = {};
        if (req.query.season_id) {
            const seasonId = parseInt(req.query.season_id, 10);
            if (!isNaN(seasonId)) filters.season_id = seasonId;
             else return res.status(400).json({ message: 'Invalid season_id format' });
        }
        if (req.query.team_id) {
            const teamId = parseInt(req.query.team_id, 10);
             if (!isNaN(teamId)) filters.team_id = teamId;
             else return res.status(400).json({ message: 'Invalid team_id format' });
        }

        const meets = await meetService.getAllMeets(filters);
        res.json(meets);
    } catch (err) {
        console.error('Error in GET /meets route:', err);
        res.status(500).json({ message: 'Error fetching meets' });
    }
});


// GET /api/meets/:id - Get a single meet by ID
router.get('/:id', async (req, res, next) => {
    try {
        const meetId = parseInt(req.params.id, 10);
        if (isNaN(meetId)) {
            return res.status(400).json({ message: 'Invalid meet ID format' });
        }
        const meet = await meetService.getMeetById(meetId);
        if (!meet) {
            return res.status(404).json({ message: 'Meet not found' });
        }
        res.json(meet);
    } catch (err) {
        console.error('Error in GET /meets/:id route:', err);
        res.status(500).json({ message: 'Error fetching meet' });
    }
});

// PUT /api/meets/:id - Update a meet
router.put('/:id', async (req, res, next) => {
    try {
        const meetId = parseInt(req.params.id, 10);
        if (isNaN(meetId)) {
            return res.status(400).json({ message: 'Invalid meet ID format' });
        }

         // Add validation for field types if needed
        const updateData = req.body;
         if (Object.keys(updateData).length === 0) {
             return res.status(400).json({ message: 'No update fields provided' });
         }
         // Prevent updating team1_id and team2_id to be the same? Service might handle.

        const updatedMeet = await meetService.updateMeet(meetId, updateData);
        if (!updatedMeet) {
            // Should be handled if service checks ID first or RETURNING yields nothing
             return res.status(404).json({ message: 'Meet not found' });
        }
        res.json(updatedMeet);
    } catch (err) {
        console.error('Error in PUT /meets/:id route:', err);
        if (err.message.includes('Foreign key constraint violation')) {
             res.status(400).json({ message: err.message });
        } else if (err.message.includes('cannot be the same')) {
            res.status(400).json({ message: err.message });
        } else {
             res.status(500).json({ message: 'Error updating meet' });
        }
    }
});


// DELETE /api/meets/:id - Delete a meet
router.delete('/:id', async (req, res, next) => {
    try {
        const meetId = parseInt(req.params.id, 10);
        if (isNaN(meetId)) {
            return res.status(400).json({ message: 'Invalid meet ID format' });
        }
        const deletedMeet = await meetService.deleteMeet(meetId);
        if (!deletedMeet) {
            return res.status(404).json({ message: 'Meet not found' });
        }
        res.json(deletedMeet); // Return deleted meet data
    } catch (err) {
        console.error('Error in DELETE /meets/:id route:', err);
         res.status(500).json({ message: 'Error deleting meet' });
    }
});

module.exports = router; 