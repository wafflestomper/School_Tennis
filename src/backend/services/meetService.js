const db = require('../db');

const createMeet = async (meetData) => {
    const {
        season_id, // Optional for now
        meet_date, // Required
        location,  // Optional
        team1_id,  // Required
        team2_id,  // Required
        meet_format_id // Required
        // winner_team_id, team1_score, team2_score will be updated later
    } = meetData;

    if (!meet_date || !team1_id || !team2_id || !meet_format_id) {
        throw new Error('Missing required fields: meet_date, team1_id, team2_id, meet_format_id');
    }
    if (team1_id === team2_id) {
         throw new Error('team1_id and team2_id cannot be the same.');
    }
     // Add validation for existence of season, teams, format later

    const queryText = `
        INSERT INTO meets (season_id, meet_date, location, team1_id, team2_id, meet_format_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *;
    `;
    const values = [season_id || null, meet_date, location || null, team1_id, team2_id, meet_format_id];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating meet:', err);
        // Check foreign key violations
        if (err.code === '23503') {
            // Provide more specific error based on constraint name
             if (err.constraint && err.constraint.includes('team1_id')) throw new Error(`Team with team1_id ${team1_id} does not exist.`);
             if (err.constraint && err.constraint.includes('team2_id')) throw new Error(`Team with team2_id ${team2_id} does not exist.`);
             if (err.constraint && err.constraint.includes('season_id')) throw new Error(`Season with season_id ${season_id} does not exist.`);
             if (err.constraint && err.constraint.includes('meet_format_id')) throw new Error(`Meet format with meet_format_id ${meet_format_id} does not exist.`);
             throw new Error('Foreign key constraint violation.'); // Generic fallback
        }
        throw err;
    }
};

const getAllMeets = async (filters = {}) => {
    // Basic filtering by season or team
    let queryText = `
        SELECT m.*,
               t1.name as team1_name,
               t2.name as team2_name,
               mf.name as format_name
        FROM meets m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        JOIN meet_formats mf ON m.meet_format_id = mf.id
    `;
    const values = [];
    const conditions = [];
    let valueIndex = 1;

    if (filters.season_id) {
        conditions.push(`m.season_id = $${valueIndex++}`);
        values.push(filters.season_id);
    }
    if (filters.team_id) {
        // Matches where the team is either team1 or team2
        conditions.push(`(m.team1_id = $${valueIndex} OR m.team2_id = $${valueIndex})`);
        values.push(filters.team_id);
         valueIndex++;
    }

     if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY m.meet_date DESC;'; // Order by most recent

    try {
        const result = await db.query(queryText, values);
        return result.rows;
    } catch (err) {
        console.error('Error fetching all meets:', err);
        throw err;
    }
};


const getMeetById = async (meetId) => {
     // Join with related tables for more context
    const queryText = `
        SELECT m.*,
               t1.name as team1_name,
               t2.name as team2_name,
               mf.name as format_name,
               s.name as season_name
        FROM meets m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        JOIN meet_formats mf ON m.meet_format_id = mf.id
        LEFT JOIN seasons s ON m.season_id = s.id -- Left join in case season is null
        WHERE m.id = $1;
    `;
    const values = [meetId];
    try {
        const result = await db.query(queryText, values);
        // Potentially fetch related matches here too? Or separate endpoint.
        return result.rows[0]; // Returns meet or undefined
    } catch (err) {
        console.error(`Error fetching meet with ID ${meetId}:`, err);
        throw err;
    }
};

// Update meet details (date, location, score, winner, etc.)
const updateMeet = async (meetId, meetData) => {
     const {
        season_id, meet_date, location, team1_id, team2_id, winner_team_id,
        team1_score, team2_score, meet_format_id
    } = meetData;

    const fields = [];
    const values = [];
    let valueIndex = 1;

    // Add validation for existence of foreign keys if provided
     if (season_id !== undefined) { fields.push(`season_id = $${valueIndex++}`); values.push(season_id); }
     if (meet_date !== undefined) { fields.push(`meet_date = $${valueIndex++}`); values.push(meet_date); }
     if (location !== undefined) { fields.push(`location = $${valueIndex++}`); values.push(location); }
     if (team1_id !== undefined) { fields.push(`team1_id = $${valueIndex++}`); values.push(team1_id); }
     if (team2_id !== undefined) { fields.push(`team2_id = $${valueIndex++}`); values.push(team2_id); }
     if (winner_team_id !== undefined) { fields.push(`winner_team_id = $${valueIndex++}`); values.push(winner_team_id); }
     if (team1_score !== undefined) { fields.push(`team1_score = $${valueIndex++}`); values.push(team1_score); }
     if (team2_score !== undefined) { fields.push(`team2_score = $${valueIndex++}`); values.push(team2_score); }
     if (meet_format_id !== undefined) { fields.push(`meet_format_id = $${valueIndex++}`); values.push(meet_format_id); }


    if (fields.length === 0) {
        // No fields provided to update
        return getMeetById(meetId);
    }

    // Always update the updated_at timestamp
    fields.push(`updated_at = NOW()`);
    values.push(meetId); // For WHERE clause

    const queryText = `
        UPDATE meets
        SET ${fields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *;
    `;
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating meet with ID ${meetId}:`, err);
         // Add more specific FK error handling if needed
         if (err.code === '23503') {
             throw new Error('Foreign key constraint violation during update.');
        }
        if (err.message && err.message.includes('meets_team1_id_fkey') && err.message.includes('meets_team2_id_fkey') ) {
            // This check might not be robust enough
             throw new Error('team1_id and team2_id cannot be the same.');
        }
        throw err;
    }
};


const deleteMeet = async (meetId) => {
    // Deleting a meet will cascade delete related matches due to schema constraint.
    const selectQuery = 'SELECT * FROM meets WHERE id = $1'; // Fetch before delete
    const deleteQuery = 'DELETE FROM meets WHERE id = $1';
    const values = [meetId];
    try {
        const meetResult = await db.query(selectQuery, values);
        const meetToDelete = meetResult.rows[0];
        if (!meetToDelete) {
            return null; // Not found
        }
        await db.query(deleteQuery, values);
        return meetToDelete; // Return deleted meet data
    } catch (err) {
        console.error(`Error deleting meet with ID ${meetId}:`, err);
        // FK errors from other tables referencing meets? Schema doesn't show direct refs.
        throw err;
    }
};


module.exports = {
  createMeet,
  getAllMeets,
  getMeetById,
  updateMeet,
  deleteMeet,
}; 