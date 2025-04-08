const db = require('../db');

// Service functions for interacting with the 'roles' table

/**
 * Fetches all roles from the database.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of role objects.
 */
const getAllRoles = async () => {
    const queryText = 'SELECT * FROM roles ORDER BY id ASC;';
    try {
        const result = await db.query(queryText);
        return result.rows;
    } catch (err) {
        console.error('Error fetching all roles:', err);
        throw new Error('Database error fetching roles.'); // Generic error for security
    }
};

/**
 * Fetches a single role by its ID.
 * @param {number} roleId - The ID of the role to fetch.
 * @returns {Promise<object|undefined>} A promise that resolves to the role object or undefined if not found.
 */
const getRoleById = async (roleId) => {
    const queryText = 'SELECT * FROM roles WHERE id = $1';
    const values = [roleId];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0]; // Returns role or undefined
    } catch (err) {
        console.error(`Error fetching role with ID ${roleId}:`, err);
        throw new Error('Database error fetching role by ID.'); // Generic error
    }
};

/**
 * Creates a new role in the database.
 * @param {object} roleData - Data for the new role (should include 'name').
 * @returns {Promise<object>} A promise that resolves to the newly created role object.
 */
const createRole = async (roleData) => {
    const { name } = roleData;
    if (!name) {
        throw new Error('Missing required field: name');
    }
    const queryText = `
        INSERT INTO roles (name)
        VALUES ($1)
        RETURNING *;
    `;
    const values = [name];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating role:', err);
        if (err.code === '23505') { // Unique violation (e.g., role name already exists)
            throw new Error(`Role with name '${name}' already exists.`);
        }
        throw new Error('Database error creating role.');
    }
};

/**
 * Updates an existing role.
 * @param {number} roleId - The ID of the role to update.
 * @param {object} updateData - An object containing the fields to update (e.g., { name }).
 * @returns {Promise<object|undefined>} A promise that resolves to the updated role object or undefined if not found.
 */
const updateRole = async (roleId, updateData) => {
    const { name } = updateData;
    if (!name) {
        // Or allow updating other fields if they exist
        throw new Error("No update fields provided or field 'name' is missing.");
    }

    const queryText = `
        UPDATE roles
        SET name = $1
        WHERE id = $2
        RETURNING *;
    `;
    const values = [name, roleId];
    try {
        const result = await db.query(queryText, values);
        if (result.rowCount === 0) {
             return undefined; // Role not found
        }
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating role with ID ${roleId}:`, err);
         if (err.code === '23505') {
             throw new Error(`Role with name '${name}' already exists.`);
        }
        throw new Error('Database error updating role.');
    }
};

/**
 * Deletes a role by its ID.
 * @param {number} roleId - The ID of the role to delete.
 * @returns {Promise<object|undefined>} A promise that resolves to the deleted role object or undefined if not found.
 */
const deleteRole = async (roleId) => {
     // First, check if the role exists before attempting deletion
    const selectQuery = 'SELECT * FROM roles WHERE id = $1';
    const deleteQuery = 'DELETE FROM roles WHERE id = $1';
    const values = [roleId];

    try {
         // Check if any users are assigned this role before deleting?
        // Depending on schema (ON DELETE RESTRICT/SET NULL/CASCADE), this might fail anyway.
        // Example check (optional):
        // const userCheckQuery = 'SELECT 1 FROM users WHERE role_id = $1 LIMIT 1';
        // const userCheckResult = await db.query(userCheckQuery, values);
        // if (userCheckResult.rowCount > 0) {
        //     throw new Error(`Cannot delete role ID ${roleId} as it is currently assigned to users.`);
        // }

        const roleResult = await db.query(selectQuery, values);
        const roleToDelete = roleResult.rows[0];

        if (!roleToDelete) {
            return undefined; // Not found
        }

        await db.query(deleteQuery, values);
        return roleToDelete; // Return the deleted role data
    } catch (err) {
        console.error(`Error deleting role with ID ${roleId}:`, err);
         // Handle specific FK violation if ON DELETE RESTRICT is used in users table
        if (err.code === '23503') { // Foreign key violation
            throw new Error(`Cannot delete role ID ${roleId} because it is referenced by users.`);
        }
        throw new Error('Database error deleting role.');
    }
};

module.exports = {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
}; 