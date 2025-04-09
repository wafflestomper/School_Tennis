const db = require('../db');
const bcrypt = require('bcryptjs');

/**
 * Creates a new user.
 * Hashes the password if provided.
 * @param {object} userData - User data (email, name, role_id, [password], [google_id]).
 * @returns {Promise<object>} The newly created user object (without password hash).
 */
const createUser = async (userData) => {
    const { email, name, role_id, password, google_id } = userData;
    if (!email || !name || !role_id) {
        throw new Error('Missing required fields: email, name, role_id');
    }

    let hashedPassword = null;
    if (password) {
         // Hash the password before storing
         const salt = await bcrypt.genSalt(10);
         hashedPassword = await bcrypt.hash(password, salt);
    }

    const queryText = `
        INSERT INTO users (email, name, role_id, password, google_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, google_id, email, name, role_id, created_at, updated_at; -- Exclude password hash
    `;
    const values = [email, name, role_id, hashedPassword, google_id || null];

    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        if (err.code === '23505') { // Unique violation (email or google_id)
            if (err.constraint === 'users_email_key') {
                 throw new Error(`User with email '${email}' already exists.`);
            }
             if (err.constraint === 'users_google_id_key') {
                 throw new Error(`User with Google ID '${google_id}' already exists.`);
            }
            throw new Error('User uniqueness constraint violated.');
        }
        if (err.code === '23503') { // Foreign key violation (role_id)
             throw new Error(`Role with ID '${role_id}' does not exist.`);
        }
        throw new Error('Database error creating user.');
    }
};

/**
 * Finds a user by their email address.
 * Returns the full user object including the password hash.
 * @param {string} email - The email to search for.
 * @returns {Promise<object|undefined>} The user object or undefined if not found.
 */
const findUserByEmail = async (email) => {
     if (!email) return undefined;
     try {
         const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
         return result.rows[0];
     } catch (err) {
         console.error(`Error finding user by email ${email}:`, err);
         throw new Error('Database error finding user by email.');
     }
 };

 /**
 * Finds a user by their Google ID.
 * Returns the user object excluding the password hash.
 * @param {string} googleId - The Google ID to search for.
 * @returns {Promise<object|undefined>} The user object or undefined if not found.
 */
 const findUserByGoogleId = async (googleId) => {
    if (!googleId) return undefined;
     try {
         const result = await db.query('SELECT id, google_id, email, name, role_id, created_at, updated_at FROM users WHERE google_id = $1', [googleId]);
         return result.rows[0];
     } catch (err) {
         console.error(`Error finding user by googleId ${googleId}:`, err);
         throw new Error('Database error finding user by Google ID.');
     }
 };

const getAllUsers = async () => {
    const queryText = 'SELECT id, google_id, email, name, role_id, created_at, updated_at FROM users ORDER BY id ASC;';
    try {
        const result = await db.query(queryText);
        return result.rows;
    } catch (err) {
        console.error('Error fetching all users:', err);
        throw err;
    }
};

const getUserById = async (userId) => {
    const queryText = 'SELECT id, google_id, email, name, role_id, created_at, updated_at FROM users WHERE id = $1';
    const values = [userId];
    try {
        const result = await db.query(queryText, values);
        return result.rows[0];
    } catch (err) {
        console.error(`Error fetching user with ID ${userId}:`, err);
        throw err;
    }
};

const updateUser = async (userId, userData) => {
    const { email, name, role_id, google_id } = userData;
    // Exclude password from direct updates via this generic endpoint
    if (userData.password !== undefined) {
        throw new Error('Password updates should be handled via dedicated authentication routes.');
    }

    const fields = [];
    const values = [];
    let valueIndex = 1;

    const addField = (field, value) => {
        if (value !== undefined) {
             // Allow setting google_id to null?
            fields.push(`${field} = $${valueIndex++}`);
            values.push(value);
        }
    };

    addField('email', email);
    addField('name', name);
    addField('role_id', role_id);
    addField('google_id', google_id);

    if (fields.length === 0) {
        return getUserById(userId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const queryText = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING id, google_id, email, name, role_id, created_at, updated_at;
    `;

    try {
        const result = await db.query(queryText, values);
        if (result.rowCount === 0) {
             return undefined; // User not found
        }
        return result.rows[0];
    } catch (err) {
        console.error(`Error updating user with ID ${userId}:`, err);
        if (err.code === '23505') { // Unique violation
            throw new Error('Email or Google ID already in use by another user.');
        }
         if (err.code === '23503') { // FK violation (role_id)
             throw new Error(`Role with ID '${role_id}' does not exist.`);
        }
        throw err;
    }
};

const deleteUser = async (userId) => {
    const selectQuery = 'SELECT id, email, name FROM users WHERE id = $1'; // Don't need password
    const deleteQuery = 'DELETE FROM users WHERE id = $1';
    const values = [userId];
    try {
        const userResult = await db.query(selectQuery, values);
        const userToDelete = userResult.rows[0];
        if (!userToDelete) {
            return null;
        }
        await db.query(deleteQuery, values);
        return userToDelete;
    } catch (err) {
        console.error(`Error deleting user with ID ${userId}:`, err);
        throw err;
    }
};

module.exports = {
    createUser,
    findUserByEmail,
    findUserByGoogleId,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
}; 