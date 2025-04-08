const db = require('../db');

/**
 * Creates a new set record for a match.
 * @param {object} setData - Data for the new set.
 *   Required: match_id, set_number, team1_games_won, team2_games_won.
 *   Optional: tiebreak_score_team1, tiebreak_score_team2.
 * @returns {Promise<object>} The newly created set object.
 */
const createSet = async (setData) => {
    const { match_id, set_number, team1_games_won, team2_games_won, tiebreak_score_team1, tiebreak_score_team2 } = setData;

    // Basic validation
    if (match_id === undefined || set_number === undefined || team1_games_won === undefined || team2_games_won === undefined) {
        throw new Error('Missing required fields: match_id, set_number, team1_games_won, team2_games_won');
    }
    if (typeof match_id !== 'number' || typeof set_number !== 'number' || typeof team1_games_won !== 'number' || typeof team2_games_won !== 'number') {
        throw new Error('Invalid data type for required fields (must be numbers).');
    }
     // Add more validation: check match_id exists? check games_won are non-negative (schema does this)?
     // Validate tiebreak scores if provided?

    const queryText = `
        INSERT INTO sets (match_id, set_number, team1_games_won, team2_games_won, tiebreak_score_team1, tiebreak_score_team2, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *;
    `;
    const values = [
        match_id,
        set_number,
        team1_games_won,
        team2_games_won,
        tiebreak_score_team1 === undefined ? null : tiebreak_score_team1,
        tiebreak_score_team2 === undefined ? null : tiebreak_score_team2
    ];

    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating set:', err);
        if (err.code === '23503') { // Foreign key violation (match_id)
            throw new Error(`Foreign key constraint violation: Match with ID ${match_id} does not exist.`);
        }
        if (err.code === '23505') { // Unique violation (match_id, set_number)
            throw new Error(`Set number ${set_number} already exists for match ID ${match_id}.`);
        }
        if (err.code === '23514') { // Check constraint violation (e.g., games >= 0)
             throw new Error('Check constraint violation (e.g., games_won must be non-negative).');
        }
        throw new Error('Database error creating set.');
    }
};

/**
 * Fetches all sets for a given match.
 * @param {number} matchId - The ID of the match.
 * @returns {Promise<Array<object>>} An array of set objects for the match, ordered by set_number.
 */
const getSetsByMatchId = async (matchId) => {
    if (typeof matchId !== 'number') {
        throw new Error('Invalid match ID.');
    }
    const queryText = 'SELECT * FROM sets WHERE match_id = $1 ORDER BY set_number ASC';
    const values = [matchId];
    try {
        const result = await db.query(queryText, values);
        return result.rows;
    } catch (err) {
        console.error(`Error fetching sets for match ID ${matchId}:`, err);
        throw new Error('Database error fetching sets.');
    }
};

/**
 * Fetches a single set by its ID.
 * @param {number} setId - The ID of the set to fetch.
 * @returns {Promise<object|undefined>} The set object or undefined if not found.
 */
const getSetById = async (setId) => {
    const queryText = 'SELECT * FROM sets WHERE id = $1';
    const values = [setId];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error(`Error fetching set with ID ${setId}:`, err);
        throw new Error('Database error fetching set by ID.');
    }
};

/**
 * Updates an existing set.
 * Can update scores.
 * @param {number} setId - The ID of the set to update.
 * @param {object} updateData - Fields to update (team1_games_won, team2_games_won, tiebreak scores).
 * @returns {Promise<object|undefined>} The updated set object or undefined if not found.
 */
const updateSet = async (setId, updateData) => {
    const { team1_games_won, team2_games_won, tiebreak_score_team1, tiebreak_score_team2 } = updateData;
    const fields = [];
    const values = [];
    let valueIndex = 1;

    const addField = (field, value) => {
        // Allow updating to null for tiebreak scores
        if (value !== undefined) {
            fields.push(`${field} = $${valueIndex++}`);
            values.push(value);
        }
    };

    addField('team1_games_won', team1_games_won);
    addField('team2_games_won', team2_games_won);
    addField('tiebreak_score_team1', tiebreak_score_team1);
    addField('tiebreak_score_team2', tiebreak_score_team2);

    if (fields.length === 0) {
        return getSetById(setId); // Nothing to update
    }

    fields.push(`updated_at = NOW()`);
    values.push(setId); // For WHERE clause

    const queryText = `
        UPDATE sets
        SET ${fields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *;
    `;

    try {
         // Add validation: games_won non-negative? tiebreak scores valid?
        const result = await db.query(queryText, values);
        if (result.rowCount === 0) {
            return undefined; // Set not found
        }
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating set with ID ${setId}:`, err);
        if (err.code === '23514') { // Check constraint violation
             throw new Error('Check constraint violation (e.g., games_won must be non-negative).');
        }
        throw new Error('Database error updating set.');
    }
};

/**
 * Deletes a set by its ID.
 * @param {number} setId - The ID of the set to delete.
 * @returns {Promise<object|undefined>} The deleted set object or undefined if not found.
 */
const deleteSet = async (setId) => {
    const selectQuery = 'SELECT * FROM sets WHERE id = $1';
    const deleteQuery = 'DELETE FROM sets WHERE id = $1';
    const values = [setId];

    try {
        const setResult = await db.query(selectQuery, values);
        const setToDelete = setResult.rows[0];

        if (!setToDelete) {
            return undefined; // Not found
        }

        await db.query(deleteQuery, values);
        return setToDelete; // Return deleted data
    } catch (err) {
        console.error(`Error deleting set with ID ${setId}:`, err);
        throw new Error('Database error deleting set.');
    }
};

module.exports = {
    createSet,
    getSetsByMatchId,
    getSetById,
    updateSet,
    deleteSet,
}; 