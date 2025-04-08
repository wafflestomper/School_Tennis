const db = require('../db');

// Note: A 'player' is essentially a user linked to a team.
// The 'players' table acts as a join table with extra info (is_captain).

const createPlayer = async (playerData) => {
    const { user_id, team_id, is_captain = false } = playerData; // Default is_captain to false
    if (!user_id) {
        throw new Error('Missing required field: user_id');
    }
    // team_id is nullable according to schema, allowing unassigned players initially

    // Add validation later: check user_id exists in users, team_id exists in teams if provided

    const queryText = `
        INSERT INTO players (user_id, team_id, is_captain, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING *;
    `;
    const values = [user_id, team_id || null, is_captain]; // Ensure team_id is null if not provided
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating player:', err);
        // Check for unique constraint violation (e.g., user_id must be unique in players)
        if (err.code === '23505') { // Unique violation
            throw new Error(`User with user_id ${user_id} is already a player.`);
        }
         // Check for foreign key violations
        if (err.code === '23503') {
            if (err.constraint === 'players_user_id_fkey') {
                 throw new Error(`User with user_id ${user_id} does not exist.`);
            }
            if (err.constraint === 'players_team_id_fkey') {
                 throw new Error(`Team with team_id ${team_id} does not exist.`);
            }
        }
        throw err;
    }
};

const getAllPlayers = async () => {
    // Consider joining with users/teams for more useful info?
    const queryText = 'SELECT * FROM players ORDER BY id ASC;';
    try {
        const result = await db.query(queryText);
        return result.rows;
    } catch (err) {
        console.error('Error fetching all players:', err);
        throw err;
    }
};

// Maybe more useful: Get players by team?
const getPlayersByTeam = async (teamId) => {
     const queryText = `
        SELECT p.*, u.name as user_name, u.email as user_email
        FROM players p
        JOIN users u ON p.user_id = u.id
        WHERE p.team_id = $1
        ORDER BY u.name ASC;
     `;
     const values = [teamId];
    try {
        const result = await db.query(queryText, values);
        return result.rows;
    } catch (err) {
        console.error(`Error fetching players for team ID ${teamId}:`, err);
        throw err;
    }
};


const getPlayerById = async (playerId) => {
    // Join with user/team for context?
    const queryText = 'SELECT * FROM players WHERE id = $1';
     // Alternative: Fetch by user_id?
     // const queryText = 'SELECT * FROM players WHERE user_id = $1';
    const values = [playerId];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0]; // Returns player or undefined
    } catch (err) {
        console.error(`Error fetching player with ID ${playerId}:`, err);
        throw err;
    }
};

// Update player's team assignment or captain status
const updatePlayer = async (playerId, playerData) => {
    const { team_id, is_captain } = playerData;
    const fields = [];
    const values = [];
    let valueIndex = 1;

    // Add validation later: check team_id exists if provided

    // Allow setting team_id to null (unassigning from team)
    if (team_id !== undefined) {
        fields.push(`team_id = $${valueIndex++}`);
        values.push(team_id);
    }
     if (is_captain !== undefined) {
         if (typeof is_captain !== 'boolean') throw new Error('is_captain must be a boolean');
        fields.push(`is_captain = $${valueIndex++}`);
        values.push(is_captain);
    }

    // Always update the updated_at timestamp
    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) { // Only updated_at added
        return getPlayerById(playerId); // No data fields to update
    }

    values.push(playerId); // For WHERE clause

    const queryText = `
        UPDATE players
        SET ${fields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *;
    `;
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating player with ID ${playerId}:`, err);
        // Check for foreign key violations
        if (err.code === '23503' && err.constraint === 'players_team_id_fkey') {
            throw new Error(`Team with team_id ${team_id} does not exist.`);
        }
        throw err;
    }
};


const deletePlayer = async (playerId) => {
    // Deleting a player record removes the user's link to a team.
    // The user record itself is NOT deleted.
    const selectQuery = 'SELECT * FROM players WHERE id = $1';
    const deleteQuery = 'DELETE FROM players WHERE id = $1';
    const values = [playerId];
    try {
        const playerResult = await db.query(selectQuery, values);
        const playerToDelete = playerResult.rows[0];
        if (!playerToDelete) {
            return null; // Not found
        }
        await db.query(deleteQuery, values);
        return playerToDelete; // Return deleted player data
    } catch (err) {
        console.error(`Error deleting player with ID ${playerId}:`, err);
        // FK constraints from matches/stats referencing players? Schema uses ON DELETE SET NULL/CASCADE
        throw err;
    }
};


module.exports = {
  createPlayer,
  getAllPlayers,
  getPlayersByTeam, // Added helper
  getPlayerById,
  updatePlayer,
  deletePlayer,
}; 