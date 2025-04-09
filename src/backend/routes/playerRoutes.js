const express = require('express');
const playerService = require('../services/playerService');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/players - Create a new player record (link user to team)
router.post('/', ensureAuthenticated, async (req, res, next) => {
    try {
        const { user_id, team_id, is_captain } = req.body;
        if (!user_id) {
             return res.status(400).json({ message: 'Missing required field: user_id' });
        }
         // Validate types
         if (typeof user_id !== 'number') return res.status(400).json({ message: 'user_id must be a number' });
         if (team_id !== undefined && team_id !== null && typeof team_id !== 'number') return res.status(400).json({ message: 'team_id must be a number or null' });
         if (is_captain !== undefined && typeof is_captain !== 'boolean') return res.status(400).json({ message: 'is_captain must be a boolean' });


        const newPlayer = await playerService.createPlayer(req.body);
        res.status(201).json(newPlayer);
    } catch (err) {
        console.error('Error in POST /players route:', err);
         if (err.message.includes('already a player') || err.message.includes('does not exist')) {
            res.status(409).json({ message: err.message }); // Conflict or Bad Request (FK violation)
        } else if (err.message.includes('Missing required field')) {
            res.status(400).json({ message: err.message });
        }
         else {
            res.status(500).json({ message: 'Error creating player' });
        }
    }
});

// GET /api/players - Get all player records
router.get('/', async (req, res, next) => {
    try {
        // Optional query param to filter by team_id
        const teamId = req.query.team_id ? parseInt(req.query.team_id, 10) : null;

        let players;
        if (teamId && !isNaN(teamId)) {
            players = await playerService.getPlayersByTeam(teamId);
        } else {
            players = await playerService.getAllPlayers();
        }
        res.json(players);
    } catch (err) {
        console.error('Error in GET /players route:', err);
        res.status(500).json({ message: 'Error fetching players' });
    }
});


// GET /api/players/:id - Get a single player record by its ID
router.get('/:id', async (req, res, next) => {
    try {
        const playerId = parseInt(req.params.id, 10);
        if (isNaN(playerId)) {
            return res.status(400).json({ message: 'Invalid player ID format' });
        }
        const player = await playerService.getPlayerById(playerId);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.json(player);
    } catch (err) {
        console.error('Error in GET /players/:id route:', err);
        res.status(500).json({ message: 'Error fetching player' });
    }
});

// PUT /api/players/:id - Update a player's team or captain status
router.put('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        const playerId = parseInt(req.params.id, 10);
        if (isNaN(playerId)) {
            return res.status(400).json({ message: 'Invalid player ID format' });
        }

        const { team_id, is_captain } = req.body;
        if (team_id === undefined && is_captain === undefined) {
            return res.status(400).json({ message: 'No update fields provided (team_id or is_captain required)' });
        }
        // Validate types if provided
        if (team_id !== undefined && team_id !== null && typeof team_id !== 'number') return res.status(400).json({ message: 'team_id must be a number or null' });
        if (is_captain !== undefined && typeof is_captain !== 'boolean') return res.status(400).json({ message: 'is_captain must be a boolean' });


        const updatedPlayer = await playerService.updatePlayer(playerId, req.body);
        if (!updatedPlayer) {
             return res.status(404).json({ message: 'Player not found' });
        }
        res.json(updatedPlayer);
    } catch (err) {
        console.error('Error in PUT /players/:id route:', err);
         if (err.message.includes('does not exist')) {
            res.status(400).json({ message: err.message }); // Bad Request (FK violation)
        } else if (err.message.includes('must be a boolean')) {
             res.status(400).json({ message: err.message });
        } else {
            res.status(500).json({ message: 'Error updating player' });
        }
    }
});


// DELETE /api/players/:id - Delete a player record (unlinks user from team)
router.delete('/:id', ensureAuthenticated, async (req, res, next) => {
    try {
        // Check user role - Only Admin or Coach can delete
        if (!req.user || !['Admin', 'Coach'].includes(req.user.role_name)) {
             return res.status(403).json({ message: 'Forbidden: Only Admins or Coaches can delete players.' });
        }

        const playerId = parseInt(req.params.id, 10);
        if (isNaN(playerId)) {
            return res.status(400).json({ message: 'Invalid player ID format' });
        }
        const deletedPlayer = await playerService.deletePlayer(playerId);
        if (!deletedPlayer) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.json(deletedPlayer); // Return deleted player data
    } catch (err) {
        console.error('Error in DELETE /players/:id route:', err);
         res.status(500).json({ message: 'Error deleting player' });
    }
});

module.exports = router; 