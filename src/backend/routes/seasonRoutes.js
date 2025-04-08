const express = require('express');
const {
    createSeason,
    getAllSeasons,
    getSeasonById,
    updateSeason,
    deleteSeason
} = require('../services/seasonService');

const router = express.Router();

// POST /api/seasons - Create a new season
router.post('/', async (req, res, next) => {
    try {
        // Add validation for required fields and data types (e.g., date format)
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Missing required field: name' });
        }
        // Basic date validation example (can be more robust)
        const { start_date, end_date } = req.body;
        if (start_date && isNaN(Date.parse(start_date))) {
             return res.status(400).json({ message: 'Invalid start_date format' });
        }
        if (end_date && isNaN(Date.parse(end_date))) {
             return res.status(400).json({ message: 'Invalid end_date format' });
        }
        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
             return res.status(400).json({ message: 'start_date cannot be after end_date' });
        }

        const newSeason = await createSeason(req.body);
        res.status(201).json(newSeason);
    } catch (err) {
        console.error('Error in POST /seasons route:', err);
        if (err.message.includes('already exists')) {
            return res.status(409).json({ message: err.message });
        }
         if (err.message.includes('Missing required') || err.message.includes('Invalid') || err.message.includes('cannot be after')) {
             return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: err.message || 'Error creating season' });
    }
});

// GET /api/seasons - Get all seasons
router.get('/', async (req, res, next) => {
    try {
        const seasons = await getAllSeasons();
        res.json(seasons);
    } catch (err) {
        console.error('Error in GET /seasons route:', err);
        res.status(500).json({ message: err.message || 'Error fetching seasons' });
    }
});

// GET /api/seasons/:id - Get a single season by ID
router.get('/:id', async (req, res, next) => {
    try {
        const seasonId = parseInt(req.params.id, 10);
        if (isNaN(seasonId)) {
            return res.status(400).json({ message: 'Invalid season ID format' });
        }
        const season = await getSeasonById(seasonId);
        if (!season) {
            return res.status(404).json({ message: 'Season not found' });
        }
        res.json(season);
    } catch (err) {
        console.error('Error in GET /seasons/:id route:', err);
        res.status(500).json({ message: err.message || 'Error fetching season' });
    }
});

// PUT /api/seasons/:id - Update a season
router.put('/:id', async (req, res, next) => {
    try {
        const seasonId = parseInt(req.params.id, 10);
        if (isNaN(seasonId)) {
            return res.status(400).json({ message: 'Invalid season ID format' });
        }
        // Add validation for update data types
        const updateData = req.body;
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No update fields provided' });
        }
         // Add date validation similar to POST if dates are updated
         const { start_date, end_date } = updateData;
         // ... (date format and comparison validation) ...

        const updatedSeason = await updateSeason(seasonId, updateData);
        if (!updatedSeason) {
            return res.status(404).json({ message: 'Season not found' });
        }
        res.json(updatedSeason);
    } catch (err) {
        console.error('Error in PUT /seasons/:id route:', err);
         if (err.message.includes('already exists')) {
            return res.status(409).json({ message: err.message });
        }
        // Add handling for date validation errors
        res.status(500).json({ message: err.message || 'Error updating season' });
    }
});

// DELETE /api/seasons/:id - Delete a season
router.delete('/:id', async (req, res, next) => {
    try {
        const seasonId = parseInt(req.params.id, 10);
        if (isNaN(seasonId)) {
            return res.status(400).json({ message: 'Invalid season ID format' });
        }
        const deletedSeason = await deleteSeason(seasonId);
        if (!deletedSeason) {
            return res.status(404).json({ message: 'Season not found' });
        }
        res.json(deletedSeason);
    } catch (err) {
        console.error('Error in DELETE /seasons/:id route:', err);
         if (err.message.includes('referenced by meets')) {
            return res.status(409).json({ message: err.message }); // Conflict
        }
        res.status(500).json({ message: err.message || 'Error deleting season' });
    }
});

module.exports = router; 