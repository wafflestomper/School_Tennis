const db = require('../db');

/**
 * Creates a new match within a meet.
 * @param {object} matchData - Data for the new match.
 *   Required: meet_id, line_number, line_type.
 *   Optional: team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winner_code, notes.
 * @returns {Promise<object>} The newly created match object.
 */
const createMatch = async (matchData) => {
    const {
        meet_id,
        line_number,
        line_type,
        team1_player1_id,
        team1_player2_id,
        team2_player1_id,
        team2_player2_id,
        winner_code = 0,
        notes,
    } = matchData; // Default winner_code to 0 (In Progress)

    // Basic validation
    if (!meet_id || !line_number || !line_type) {
        throw new Error('Missing required fields: meet_id, line_number, line_type');
    }
    if (!['Singles', 'Doubles'].includes(line_type)) {
         throw new Error("Invalid line_type. Must be 'Singles' or 'Doubles'.");
    }
     // Add more validation: check if meet_id exists, player IDs exist, player IDs belong to correct teams in the meet?
     // Validate doubles matches have 2 players per team if provided?

    const queryText = `
        INSERT INTO matches (meet_id, line_number, line_type, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winner_code, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *;
    `;
    const values = [
        meet_id,
        line_number,
        line_type,
        team1_player1_id || null,
        team1_player2_id || null,
        team2_player1_id || null,
        team2_player2_id || null,
        winner_code,
        notes || null
    ];

    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating match:', err);
        if (err.code === '23503') { // Foreign key violation
            // Improve error message based on constraint name if possible
             throw new Error('Foreign key constraint violation. Check if meet_id or player IDs exist.');
        }
        if (err.code === '23505') { // Unique violation (meet_id, line_number, line_type)
             throw new Error(`Match line ${line_number} (${line_type}) already exists for meet ID ${meet_id}.`);
        }
         if (err.code === '23514') { // Check constraint violation (e.g., line_type)
             throw new Error(`Invalid value provided for a field (e.g., line_type).`);
        }
        throw new Error('Database error creating match.');
    }
};

/**
 * Fetches all matches, optionally filtering by meet_id.
 * @param {object} filters - Optional filters (e.g., { meet_id: number }).
 * @returns {Promise<Array<object>>} An array of match objects.
 */
const getAllMatches = async (filters = {}) => {
    let queryText = 'SELECT * FROM matches';
    const values = [];
    const conditions = [];

    if (filters.meet_id) {
         conditions.push(`meet_id = $${values.length + 1}`);
         values.push(filters.meet_id);
    }

    if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY line_type ASC, line_number ASC;'; // Example order

    try {
        const result = await db.query(queryText, values);
        return result.rows;
    } catch (err) {
        console.error('Error fetching matches:', err);
        throw new Error('Database error fetching matches.');
    }
};

/**
 * Fetches a single match by its ID.
 * @param {number} matchId - The ID of the match to fetch.
 * @returns {Promise<object|undefined>} The match object or undefined if not found.
 */
const getMatchById = async (matchId) => {
    const queryText = 'SELECT * FROM matches WHERE id = $1';
    const values = [matchId];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error(`Error fetching match with ID ${matchId}:`, err);
        throw new Error('Database error fetching match by ID.');
    }
};

/**
 * Updates an existing match.
 * Can update players, winner_code, notes.
 * @param {number} matchId - The ID of the match to update.
 * @param {object} updateData - Fields to update.
 * @returns {Promise<object|undefined>} The updated match object or undefined if not found.
 */
const updateMatch = async (matchId, updateData) => {
    const { team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id, winner_code, notes } = updateData;
    const fields = [];
    const values = [];
    let valueIndex = 1;

    // Utility to add field to update query
    const addField = (field, value) => {
        if (value !== undefined) {
            fields.push(`${field} = $${valueIndex++}`);
            values.push(value);
        }
    };

    addField('team1_player1_id', team1_player1_id);
    addField('team1_player2_id', team1_player2_id);
    addField('team2_player1_id', team2_player1_id);
    addField('team2_player2_id', team2_player2_id);
    addField('winner_code', winner_code);
    addField('notes', notes);

    if (fields.length === 0) {
        return getMatchById(matchId); // Nothing to update
    }

    fields.push(`updated_at = NOW()`);
    values.push(matchId); // For WHERE clause

    const queryText = `
        UPDATE matches
        SET ${fields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *;
    `;

    try {
        // Add validation: Check if player IDs exist? Check winner_code is valid?
        const result = await db.query(queryText, values);
        if (result.rowCount === 0) {
            return undefined; // Match not found
        }
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating match with ID ${matchId}:`, err);
        if (err.code === '23503') { // FK violation
             throw new Error('Foreign key constraint violation. Check if player IDs exist.');
        }
        if (err.code === '23514') { // Check constraint violation (e.g., winner_code)
             throw new Error('Invalid value provided for a field (e.g., winner_code).');
        }
        throw new Error('Database error updating match.');
    }
};

/**
 * Deletes a match by its ID.
 * Note: This will also delete associated sets due to ON DELETE CASCADE.
 * @param {number} matchId - The ID of the match to delete.
 * @returns {Promise<object|undefined>} The deleted match object or undefined if not found.
 */
const deleteMatch = async (matchId) => {
    const selectQuery = 'SELECT * FROM matches WHERE id = $1';
    const deleteQuery = 'DELETE FROM matches WHERE id = $1';
    const values = [matchId];

    try {
        const matchResult = await db.query(selectQuery, values);
        const matchToDelete = matchResult.rows[0];

        if (!matchToDelete) {
            return undefined; // Not found
        }

        await db.query(deleteQuery, values);
        return matchToDelete; // Return deleted data
    } catch (err) {
        // FK constraints from other tables (e.g., stats) are handled by ON DELETE CASCADE in schema
        console.error(`Error deleting match with ID ${matchId}:`, err);
        throw new Error('Database error deleting match.');
    }
};

module.exports = {
    createMatch,
    getAllMatches,
    getMatchById,
    updateMatch,
    deleteMatch,
}; 