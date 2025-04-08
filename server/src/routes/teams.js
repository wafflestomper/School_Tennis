// API Routes for Teams

const express = require('express');
const router = express.Router();
const TeamService = require('../services/teamService');
const { ensureAuthenticated, ensureRole } = require('../middleware/authMiddleware');

// --- Team Routes --- 

// GET /api/teams - Get all teams
// TODO: Refine authorization - maybe allow all authenticated users or even public?
// For now, requiring authentication.
router.get('/', ensureAuthenticated, async (req, res, next) => {
    try {
        // TODO: Add query parameter filtering (e.g., /api/teams?schoolId=1&seasonId=2)
        const teams = await TeamService.findAll();
        res.json(teams);
    } catch (error) {
        console.error('Error fetching all teams:', error);
        res.status(500).json({ message: 'Error fetching teams' });
        // next(error); // Pass to global error handler
    }
});

// GET /api/teams/:id - Get a specific team by ID
// TODO: Refine authorization - maybe allow all authenticated users or even public?
router.get('/:id', ensureAuthenticated, async (req, res, next) => {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) {
        return res.status(400).json({ message: 'Invalid team ID format.' });
    }
    try {
        const team = await TeamService.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found.' });
        }
        res.json(team);
    } catch (error) {
        console.error(`Error fetching team ${teamId}:`, error);
        res.status(500).json({ message: 'Error fetching team' });
        // next(error);
    }
});

// POST /api/teams - Create a new team
// Requires Admin or Coach role
// TODO: Coaches should likely only create teams for their assigned school.
// Need to implement school/scope check in ensureRole or a dedicated middleware.
router.post('/', ensureAuthenticated, ensureRole(['Admin', 'Coach']), async (req, res, next) => {
    const { school_id, season_id, level, team_name } = req.body;

    // Basic validation
    if (!school_id || !season_id || !level) {
        return res.status(400).json({ message: 'Missing required fields: school_id, season_id, level.' });
    }

    try {
        const newTeamData = { school_id, season_id, level, team_name };
        const createdTeam = await TeamService.create(newTeamData);
        res.status(201).json(createdTeam);
    } catch (error) {
        console.error('Error creating team:', error);
        if (error.message.includes('already exists')) {
            return res.status(409).json({ message: error.message }); // 409 Conflict
        }
        if (error.message.includes('Missing required fields')) {
             return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error creating team' });
        // next(error);
    }
});

// PUT /api/teams/:id - Update an existing team
// Requires Admin or Coach role
// TODO: Add scope checks - Admins can update any, Coaches only their own teams?
router.put('/:id', ensureAuthenticated, ensureRole(['Admin', 'Coach']), async (req, res, next) => {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) {
        return res.status(400).json({ message: 'Invalid team ID format.' });
    }

    const { level, team_name } = req.body;
    if (level === undefined && team_name === undefined) { // Check if at least one field is present
        return res.status(400).json({ message: 'No update fields provided (level, team_name).' });
    }

    try {
        const teamDataToUpdate = { level, team_name };
        const updatedTeam = await TeamService.update(teamId, teamDataToUpdate);
        if (!updatedTeam) {
            return res.status(404).json({ message: 'Team not found for update.' });
        }
        res.json(updatedTeam);
    } catch (error) {
        console.error(`Error updating team ${teamId}:`, error);
        if (error.message.includes('already exists')) {
            return res.status(409).json({ message: error.message });
        }
        if (error.message.includes('No fields provided')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error updating team' });
        // next(error);
    }
});

// DELETE /api/teams/:id - Delete a team
// Requires Admin role (potentially Coaches for their own teams - needs careful consideration)
// For now, restricting to Admin.
router.delete('/:id', ensureAuthenticated, ensureRole('Admin'), async (req, res, next) => {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) {
        return res.status(400).json({ message: 'Invalid team ID format.' });
    }

    try {
        const deletedTeam = await TeamService.delete(teamId);
        if (!deletedTeam) {
            return res.status(404).json({ message: 'Team not found for deletion.' });
        }
        // Send 200 OK with deleted object, or 204 No Content
        res.json({ message: 'Team deleted successfully', deletedTeam });
        // res.status(204).send(); 
    } catch (error) {
        console.error(`Error deleting team ${teamId}:`, error);
        res.status(500).json({ message: 'Error deleting team' });
        // next(error);
    }
});

module.exports = router; 