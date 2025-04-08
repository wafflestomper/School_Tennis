const express = require('express');
const teamService = require('../services/teamService');

const router = express.Router();

// POST /api/teams - Create a new team
router.post('/', async (req, res, next) => {
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