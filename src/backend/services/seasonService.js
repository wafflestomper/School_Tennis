const db = require('../db');

/**
 * Creates a new season in the database.
 * @param {object} seasonData - Data for the new season (e.g., { name, start_date, end_date }).
 * @returns {Promise<object>} A promise that resolves to the newly created season object.
 */
const createSeason = async (seasonData) => {
    const { name, start_date, end_date } = seasonData;
    if (!name) {
        throw new Error('Missing required field: name');
    }
    // Add validation for dates if needed

    const queryText = `
        INSERT INTO seasons (name, start_date, end_date, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING *;
    `;
    const values = [name, start_date || null, end_date || null];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating season:', err);
        if (err.code === '23505') { // Unique violation (e.g., season name)
            throw new Error(`Season with name '${name}' already exists.`);
        }
        throw new Error('Database error creating season.');
    }
};

/**
 * Fetches all seasons from the database.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of season objects.
 */
const getAllSeasons = async () => {
    const queryText = 'SELECT * FROM seasons ORDER BY start_date DESC, name ASC;'; // Example ordering
    try {
        const result = await db.query(queryText);
        return result.rows;
    } catch (err) {
        console.error('Error fetching all seasons:', err);
        throw new Error('Database error fetching seasons.');
    }
};

/**
 * Fetches a single season by its ID.
 * @param {number} seasonId - The ID of the season to fetch.
 * @returns {Promise<object|undefined>} A promise that resolves to the season object or undefined if not found.
 */
const getSeasonById = async (seasonId) => {
    const queryText = 'SELECT * FROM seasons WHERE id = $1';
    const values = [seasonId];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0]; // Returns season or undefined
    } catch (err) {
        console.error(`Error fetching season with ID ${seasonId}:`, err);
        throw new Error('Database error fetching season by ID.');
    }
};

/**
 * Updates an existing season.
 * @param {number} seasonId - The ID of the season to update.
 * @param {object} updateData - An object containing the fields to update (e.g., { name, start_date, end_date }).
 * @returns {Promise<object|undefined>} A promise that resolves to the updated season object or undefined if not found.
 */
const updateSeason = async (seasonId, updateData) => {
    const { name, start_date, end_date } = updateData;
    const fields = [];
    const values = [];
    let valueIndex = 1;

    if (name !== undefined) {
        fields.push(`name = $${valueIndex++}`);
        values.push(name);
    }
    if (start_date !== undefined) {
        fields.push(`start_date = $${valueIndex++}`);
        values.push(start_date);
    }
    if (end_date !== undefined) {
        fields.push(`end_date = $${valueIndex++}`);
        values.push(end_date);
    }

    if (fields.length === 0) {
        // No fields to update, maybe return current data or throw error?
        return getSeasonById(seasonId);
    }

    // Always update the updated_at timestamp
    fields.push(`updated_at = NOW()`);

    values.push(seasonId); // For WHERE clause

    const queryText = `
        UPDATE seasons
        SET ${fields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *;
    `;

    try {
        const result = await db.query(queryText, values);
        if (result.rowCount === 0) {
            return undefined; // Season not found
        }
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating season with ID ${seasonId}:`, err);
        if (err.code === '23505') { // Unique violation (e.g., name)
            throw new Error(`Season with name '${name}' already exists.`);
        }
        // Add checks for date constraints if necessary
        throw new Error('Database error updating season.');
    }
};

/**
 * Deletes a season by its ID.
 * @param {number} seasonId - The ID of the season to delete.
 * @returns {Promise<object|undefined>} A promise that resolves to the deleted season object or undefined if not found.
 */
const deleteSeason = async (seasonId) => {
    const selectQuery = 'SELECT * FROM seasons WHERE id = $1';
    const deleteQuery = 'DELETE FROM seasons WHERE id = $1';
    const values = [seasonId];

    try {
        // Check if meets reference this season (FK constraint handling)
        // Example check:
        // const meetCheckQuery = 'SELECT 1 FROM meets WHERE season_id = $1 LIMIT 1';
        // const meetCheckResult = await db.query(meetCheckQuery, values);
        // if (meetCheckResult.rowCount > 0) {
        //     throw new Error(`Cannot delete season ID ${seasonId} as it is referenced by meets.`);
        // }

        const seasonResult = await db.query(selectQuery, values);
        const seasonToDelete = seasonResult.rows[0];

        if (!seasonToDelete) {
            return undefined; // Not found
        }

        await db.query(deleteQuery, values);
        return seasonToDelete; // Return deleted data
    } catch (err) {
        console.error(`Error deleting season with ID ${seasonId}:`, err);
        if (err.code === '23503') { // Foreign key violation (e.g., from meets table)
            throw new Error(`Cannot delete season ID ${seasonId} because it is referenced by meets.`);
        }
        throw new Error('Database error deleting season.');
    }
};

module.exports = {
    createSeason,
    getAllSeasons,
    getSeasonById,
    updateSeason,
    deleteSeason,
}; 