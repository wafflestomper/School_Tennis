const db = require('../db');

const createTeam = async (teamData) => {
  const { name, coach_id } = teamData;
  const queryText = `
    INSERT INTO teams (name, coach_id, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    RETURNING *;
  `;
  const values = [name, coach_id];

  try {
    const result = await db.query(queryText, values);
    return result.rows[0];
  } catch (err) {
    console.error('Error creating team:', err);
    throw err;
  }
};

const getAllTeams = async () => {
  const queryText = 'SELECT * FROM teams ORDER BY name ASC;';
  try {
    const result = await db.query(queryText);
    return result.rows;
  } catch (err) {
    console.error('Error fetching all teams:', err);
    throw err;
  }
};

const getTeamById = async (teamId) => {
  const queryText = 'SELECT * FROM teams WHERE id = $1';
  const values = [teamId];

  try {
    const result = await db.query(queryText, values);
    return result.rows[0]; // Returns the team object or undefined if not found
  } catch (err) {
    console.error(`Error fetching team with ID ${teamId}:`, err);
    throw err;
  }
};

const updateTeam = async (teamId, teamData) => {
  const { name, coach_id } = teamData;
  // Build the SET part of the query dynamically based on provided fields
  const fields = [];
  const values = [];
  let valueIndex = 1;

  if (name !== undefined) {
    fields.push(`name = $${valueIndex++}`);
    values.push(name);
  }
  if (coach_id !== undefined) {
    // Allow setting coach_id to null
    fields.push(`coach_id = $${valueIndex++}`);
    values.push(coach_id);
  }

  // Always update the updated_at timestamp
  fields.push(`updated_at = NOW()`);

  if (fields.length === 1) { // Only updated_at was added
    // No actual data fields to update
    console.warn(`Update called for team ${teamId} with no data fields.`);
    // Optionally, fetch and return the current team data
    return getTeamById(teamId);
  }

  values.push(teamId); // Add the teamId for the WHERE clause

  const queryText = `
    UPDATE teams
    SET ${fields.join(', ')}
    WHERE id = $${valueIndex}
    RETURNING *;
  `;

  try {
    const result = await db.query(queryText, values);
    return result.rows[0]; // Returns the updated team or undefined if ID not found
  } catch (err) {
    console.error(`Error updating team with ID ${teamId}:`, err);
    throw err;
  }
};

const deleteTeam = async (teamId) => {
  // First, try to fetch the team to confirm it exists and return its data
  const selectQuery = 'SELECT * FROM teams WHERE id = $1';
  const deleteQuery = 'DELETE FROM teams WHERE id = $1';
  const values = [teamId];

  try {
    // Find the team first
    const teamResult = await db.query(selectQuery, values);
    const teamToDelete = teamResult.rows[0];

    if (!teamToDelete) {
      return null; // Indicate team not found
    }

    // If found, delete it
    await db.query(deleteQuery, values);

    return teamToDelete; // Return the data of the deleted team
  } catch (err) {
    console.error(`Error deleting team with ID ${teamId}:`, err);
    // Consider potential foreign key constraints if teams are referenced elsewhere
    throw err;
  }
};

module.exports = {
  createTeam,
  getAllTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
}; 