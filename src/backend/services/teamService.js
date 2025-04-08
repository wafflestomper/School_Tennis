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

module.exports = {
  createTeam,
}; 