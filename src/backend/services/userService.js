const db = require('../db');

const createUser = async (userData) => {
    // Note: google_id and password/hashing are not handled here yet.
    // Role needs to be handled - defaulting or passed in? Requires roles table check.
    // For now, simplified: requires email, name, role_id
    const { email, name, role_id, google_id } = userData;
    if (!email || !name || !role_id) {
        throw new Error('Missing required fields: email, name, role_id');
    }
    // Add validation for role_id existence in roles table later

    const queryText = `
        INSERT INTO users (email, name, role_id, google_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *;
    `;
    // Ensure google_id is passed correctly (can be null)
    const values = [email, name, role_id, google_id || null];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating user:', err);
        // Check for unique constraint violation (e.g., email)
        if (err.code === '23505') { // Unique violation
            throw new Error(`User with email ${email} already exists.`);
        }
        throw err;
    }
};

const getAllUsers = async () => {
    const queryText = 'SELECT id, email, name, role_id, created_at, updated_at FROM users ORDER BY name ASC;'; // Exclude google_id for general listing?
    try {
        const result = await db.query(queryText);
        return result.rows;
    } catch (err) {
        console.error('Error fetching all users:', err);
        throw err;
    }
};

const getUserById = async (userId) => {
    const queryText = 'SELECT id, email, name, role_id, google_id, created_at, updated_at FROM users WHERE id = $1';
    const values = [userId];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0]; // Returns user or undefined
    } catch (err) {
        console.error(`Error fetching user with ID ${userId}:`, err);
        throw err;
    }
};

const updateUser = async (userId, userData) => {
    const { email, name, role_id, google_id } = userData;
    const fields = [];
    const values = [];
    let valueIndex = 1;

    // Add validation later: check role_id exists if provided

    if (email !== undefined) {
        fields.push(`email = $${valueIndex++}`);
        values.push(email);
    }
    if (name !== undefined) {
        fields.push(`name = $${valueIndex++}`);
        values.push(name);
    }
     if (role_id !== undefined) {
        fields.push(`role_id = $${valueIndex++}`);
        values.push(role_id);
    }
    if (google_id !== undefined) {
        fields.push(`google_id = $${valueIndex++}`);
        values.push(google_id);
    }

    // Always update the updated_at timestamp
    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) { // Only updated_at added
        return getUserById(userId); // No data fields to update
    }

    values.push(userId); // For WHERE clause

    const queryText = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *;
    `;
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating user with ID ${userId}:`, err);
         // Check for unique constraint violation (e.g., email)
        if (err.code === '23505') {
             throw new Error(`Cannot update: email already in use.`);
        }
        // Add check for foreign key violation on role_id if implemented
        throw err;
    }
};


const deleteUser = async (userId) => {
    // Note: Need to consider FK constraints. If user is a coach_id on a team,
    // or referenced in players, deletion might fail or cascade depending on schema.
    // Our schema uses ON DELETE SET NULL for coach_id, ON DELETE CASCADE for players user_id
    const selectQuery = 'SELECT id, email, name FROM users WHERE id = $1'; // Select minimal needed data
    const deleteQuery = 'DELETE FROM users WHERE id = $1';
    const values = [userId];
    try {
        const userResult = await db.query(selectQuery, values);
        const userToDelete = userResult.rows[0];
        if (!userToDelete) {
            return null; // Not found
        }
        await db.query(deleteQuery, values);
        return userToDelete; // Return deleted user's basic info
    } catch (err) {
        console.error(`Error deleting user with ID ${userId}:`, err);
        // FK errors (e.g., if schema used RESTRICT) are handled by route handler
        throw err;
    }
};


module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
}; 