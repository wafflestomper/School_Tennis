const express = require('express');
const teamService = require('../services/teamService');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/teams - Get all teams
router.get('/', async (req, res, next) => {
  try {
    const teams = await teamService.getAllTeams();
    res.json(teams);
  } catch (err) {
    console.error('Error in GET /teams route:', err);
    res.status(500).json({ message: 'Error fetching teams' });
    // Or use next(err)
  }
});

// GET /api/teams/:id - Get a single team by ID
router.get('/:id', async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID format' });
    }

    const team = await teamService.getTeamById(teamId);

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(team);
  } catch (err) {
    console.error('Error in GET /teams/:id route:', err);
    res.status(500).json({ message: 'Error fetching team' });
    // Or use next(err)
  }
});

// PUT /api/teams/:id - Update a team
router.put('/:id', ensureAuthenticated, async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID format' });
    }

    // Basic validation: ensure at least one valid field is provided for update
    const { name, coach_id } = req.body;
    if (name === undefined && coach_id === undefined) {
      return res.status(400).json({ message: 'No update fields provided (name or coach_id required)' });
    }

    const updatedTeam = await teamService.updateTeam(teamId, req.body);

    if (!updatedTeam) {
      // updateTeam might return undefined if the ID wasn't found for update
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(updatedTeam);
  } catch (err) {
    console.error('Error in PUT /teams/:id route:', err);
    res.status(500).json({ message: 'Error updating team' });
    // Or use next(err)
  }
});

// DELETE /api/teams/:id - Delete a team
router.delete('/:id', ensureAuthenticated, async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID format' });
    }

    const deletedTeam = await teamService.deleteTeam(teamId);

    if (!deletedTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Send back the data of the deleted team as confirmation
    // Alternatively, could send status 204 (No Content)
    res.json(deletedTeam);
  } catch (err) {
    console.error('Error in DELETE /teams/:id route:', err);
    // Handle potential FK constraint errors if other tables reference this team
    if (err.code === '23503') { // Foreign key violation
        return res.status(409).json({ 
            message: 'Cannot delete team. It is referenced by other records (e.g., players, meets).' 
        });
    }
    res.status(500).json({ message: 'Error deleting team' });
    // Or use next(err)
  }
});

// POST /api/teams - Create a new team
router.post('/', ensureAuthenticated, async (req, res, next) => {
  try {
    // Updated validation: only 'name' is strictly required
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Missing required field: name' });
    }

    // Pass the whole req.body, allowing optional fields like coach_id
    const newTeam = await teamService.createTeam(req.body);
    res.status(201).json(newTeam);
  } catch (err) {
    // Pass error to the central error handler (if implemented)
    // For now, just log and send a generic error
    console.error('Error in POST /teams route:', err);
    res.status(500).json({ message: 'Error creating team' });
    // Or use next(err) if you have error handling middleware
  }
});

module.exports = router; 