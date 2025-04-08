// Service layer for Team related database operations

const db = require('../config/database');

const TeamService = {
    /**
     * Find all teams, potentially filtered by school or season.
     * TODO: Add filtering options (schoolId, seasonId)
     */
    async findAll() {
        try {
            // Basic query, join with schools and seasons for context
            const query = `
                SELECT 
                    t.team_id, t.level, t.team_name, t.created_at, t.updated_at,
                    s.school_id, s.name as school_name,
                    se.season_id, se.name as season_name
                FROM teams t
                JOIN schools s ON t.school_id = s.school_id
                JOIN seasons se ON t.season_id = se.season_id
                ORDER BY s.name, se.name, t.level;
            `;
            const { rows } = await db.query(query);
            return rows;
        } catch (error) {
            console.error('Error finding all teams:', error);
            throw error;
        }
    },

    /**
     * Find a specific team by its ID.
     */
    async findById(teamId) {
        try {
            const query = `
                SELECT 
                    t.team_id, t.level, t.team_name, t.created_at, t.updated_at,
                    s.school_id, s.name as school_name,
                    se.season_id, se.name as season_name
                FROM teams t
                JOIN schools s ON t.school_id = s.school_id
                JOIN seasons se ON t.season_id = se.season_id
                WHERE t.team_id = $1;
            `;
            const { rows } = await db.query(query, [teamId]);
            return rows[0]; // Return the first row or undefined
        } catch (error) {
            console.error(`Error finding team by ID ${teamId}:`, error);
            throw error;
        }
    },

    /**
     * Create a new team.
     */
    async create(teamData) {
        const { school_id, season_id, level, team_name } = teamData;
        // TODO: Add validation for required fields
        if (!school_id || !season_id || !level) {
            throw new Error('Missing required fields for creating a team.');
        }
        try {
            const query = `
                INSERT INTO teams (school_id, season_id, level, team_name)
                VALUES ($1, $2, $3, $4)
                RETURNING *;
            `;
            const values = [school_id, season_id, level, team_name];
            const { rows } = await db.query(query, values);
            console.log('Team created:', rows[0]);
            return rows[0];
        } catch (error) {
            console.error('Error creating team:', error);
            // Handle potential unique constraint violation (school_id, season_id, level)
            if (error.code === '23505') { // Unique violation code in PostgreSQL
                throw new Error('A team with this school, season, and level already exists.');
            }
            throw error;
        }
    },

    /**
     * Update an existing team.
     */
    async update(teamId, teamData) {
        const { level, team_name } = teamData; // Only allow updating certain fields
        // TODO: Add more robust update logic - handle which fields are present
        if (!level && !team_name) {
            throw new Error('No fields provided for update.');
        }

        // Build the query dynamically based on provided fields
        let updateQuery = 'UPDATE teams SET';
        const updateValues = [];
        let valueCount = 1;

        if (level !== undefined) {
            updateQuery += ` level = $${valueCount++}`;
            updateValues.push(level);
        }
        if (team_name !== undefined) {
            if (valueCount > 1) updateQuery += ',';
            updateQuery += ` team_name = $${valueCount++}`;
            updateValues.push(team_name);
        }

        updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE team_id = $${valueCount++} RETURNING *;`;
        updateValues.push(teamId);

        try {
            const { rows } = await db.query(updateQuery, updateValues);
            if (rows.length === 0) {
                return null; // Team not found
            }
            console.log('Team updated:', rows[0]);
            return rows[0];
        } catch (error) {
            console.error(`Error updating team ${teamId}:`, error);
            // Handle potential unique constraint violation if level is changed
            if (error.code === '23505') { 
                throw new Error('Update failed: A team with this school, season, and level already exists.');
            }
            throw error;
        }
    },

    /**
     * Delete a team by its ID.
     * Note: Consider implications - what happens to players, matches associated?
     * The schema uses ON DELETE CASCADE for players, ON DELETE SET NULL for matches.
     */
    async delete(teamId) {
        try {
            const query = 'DELETE FROM teams WHERE team_id = $1 RETURNING *;';
            const { rows } = await db.query(query, [teamId]);
            if (rows.length === 0) {
                return null; // Team not found
            }
            console.log('Team deleted:', rows[0]);
            return rows[0]; // Return the deleted team data
        } catch (error) {
            console.error(`Error deleting team ${teamId}:`, error);
            throw error;
        }
    },

    // TODO: Add methods to find teams by school, season, etc.
    // async findBySchool(schoolId) { ... }
    // async findBySeason(seasonId) { ... }
};

module.exports = TeamService; 