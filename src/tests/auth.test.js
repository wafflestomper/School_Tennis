// src/tests/auth.test.js
const request = require('supertest');
const app = require('../../server'); // Adjust path if server.js is located elsewhere
const db = require('../backend/db'); // Used for DB checks
const { cleanTables } = require('./setup'); // Import cleanTables

// Basic Authentication API Tests
describe('Authentication API - /api/auth', () => {
  let server;

  // Start server before all tests in this suite
  beforeAll((done) => {
    server = app.listen(0, done); // Use port 0 for random available port
  });

  // Close server after all tests in this suite
  afterAll((done) => {
    server.close(done);
    // db.pool.end(done); // Removed: Pool closed in setup.js afterAll
  });

  // Clean tables before each test in this suite
  beforeEach(cleanTables);

  // --- Registration Tests (/api/auth/register) ---
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully with valid data', async () => {
      const agent = request.agent(app); // New agent for this test
      const newUser = {
        email: 'test.user@example.com',
        password: 'password123',
        name: 'Test User',
        role_id: 3, // Added role_id (assuming 3 is 'Player' from schema seed)
      };

      const response = await agent.post('/api/auth/register').send(newUser);

      // 1. Check HTTP Status Code (e.g., 201 Created)
      expect(response.statusCode).toBe(201); // Adjust if your API returns a different success code

      // 2. Check Response Body (should return user info, excluding password)
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', newUser.email);
      expect(response.body).toHaveProperty('name', newUser.name);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).toHaveProperty('role_id'); // Check that a role was assigned

      // 3. Check Database (Verify user exists and password was hashed)
      const dbRes = await db.query('SELECT * FROM users WHERE email = $1', [newUser.email]);
      expect(dbRes.rows.length).toBe(1);
      const dbUser = dbRes.rows[0];
      expect(dbUser.email).toBe(newUser.email);
      expect(dbUser.password).toBeDefined();
      expect(dbUser.password).not.toBe(newUser.password); // Ensure password is hashed
      expect(dbUser.role_id).toBeDefined(); // Or check for specific default role ID if known
    });

    it('should return 409 Conflict when registering with an existing email', async () => {
      // Use stateless requests for both attempts to ensure isolation
      const initialUser = {
        email: 'existing.user@example.com',
        password: 'password123',
        name: 'Existing User',
        role_id: 3,
      };
      // 1. Register the initial user (stateless)
      const firstResponse = await request(app).post('/api/auth/register').send(initialUser);
      expect(firstResponse.statusCode).toBe(201); // Ensure first one succeeded

      // 2. Attempt to register again with the SAME email (stateless)
      const duplicateUser = {
        email: 'existing.user@example.com', // Same email
        password: 'anotherpassword',
        name: 'Duplicate User',
        role_id: 3,
      };
      const secondResponse = await request(app).post('/api/auth/register').send(duplicateUser);

      // 3. Assert: Check for 409 Conflict on the second attempt
      expect(secondResponse.statusCode).toBe(409);
      expect(secondResponse.body).toHaveProperty('message');
      expect(secondResponse.body.message).toMatch(/already exists/i);

      // 4. Assert: Check database - ensure only the FIRST user exists
      const dbRes = await db.query('SELECT COUNT(*) FROM users WHERE email = $1', [initialUser.email]);
      expect(parseInt(dbRes.rows[0].count, 10)).toBe(1);
    });

    it('should return 400 Bad Request if required fields are missing', async () => {
        const baseUser = {
            email: 'missing.fields@example.com',
            password: 'password123',
            name: 'Missing Fields',
            role_id: 3,
        };
        // Test missing email
        let response = await request(app).post('/api/auth/register').send({ ...baseUser, email: undefined });
        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/Missing required fields/i);
        // Test missing password
        response = await request(app).post('/api/auth/register').send({ ...baseUser, password: undefined });
        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/Missing required fields/i);
        // Test missing name
        response = await request(app).post('/api/auth/register').send({ ...baseUser, name: undefined });
        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/Missing required fields/i);
        // Test missing role_id
        response = await request(app).post('/api/auth/register').send({ ...baseUser, role_id: undefined });
        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/Missing required fields/i);
    });

    it('should return 400 Bad Request if password is too short', async () => {
      const shortPasswordUser = {
        email: 'short.pass@example.com',
        password: '12345', // Less than 6 chars
        name: 'Short Pass',
        role_id: 3,
      };
      const response = await request(app).post('/api/auth/register').send(shortPasswordUser);
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(/Password must be at least 6 characters/i);
    });

    // Optional: Add test for invalid email format if implemented

  });

  // --- Login Tests (/api/auth/login) ---
  describe('POST /api/auth/login', () => {
    const userCredentials = {
        email: 'login.test@example.com',
        password: 'password123',
        name: 'Login Test User',
        role_id: 3,
    };

    it('should log in successfully with correct credentials and set session cookie', async () => {
      const agent = request.agent(app); // New agent
      await agent.post('/api/auth/register').send(userCredentials);
      await agent.post('/api/auth/logout');

      const response = await agent.post('/api/auth/login').send({ email: userCredentials.email, password: userCredentials.password });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(userCredentials.email);
      expect(response.body).not.toHaveProperty('password');
      const statusResponse = await agent.get('/api/auth/status');
      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.body).toHaveProperty('id', response.body.id);
      expect(statusResponse.body.email).toBe(userCredentials.email);
    });
    it('should return 401 Unauthorized for incorrect password', async () => {
      const agent = request.agent(app); // New agent
      await agent.post('/api/auth/register').send(userCredentials);
      await agent.post('/api/auth/logout');

      const response = await agent.post('/api/auth/login').send({ email: userCredentials.email, password: 'wrongpassword' });
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toMatch(/Incorrect email or password/i);
      const statusResponse = await agent.get('/api/auth/status');
      expect(statusResponse.statusCode).toBe(401);
    });
    it('should return 401 Unauthorized for non-existent email', async () => {
      const agent = request.agent(app); // New agent (though stateless here)
      const response = await agent.post('/api/auth/login').send({ email: 'non.existent@example.com', password: 'password123' });
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toMatch(/Incorrect email or password/i);
      const statusResponse = await agent.get('/api/auth/status');
      expect(statusResponse.statusCode).toBe(401);
    });
    it('should return 401 Unauthorized when attempting local login for a Google-only user', async () => {
      const agent = request.agent(app); // New agent
      const googleOnlyUser = {
        email: 'google.only@example.com',
        name: 'Google User',
        google_id: 'google12345',
        role_id: 3,
      };
      await db.query(
        'INSERT INTO users (email, name, google_id, role_id, password) VALUES ($1, $2, $3, $4, NULL)',
        [googleOnlyUser.email, googleOnlyUser.name, googleOnlyUser.google_id, googleOnlyUser.role_id]
      );
      const response = await agent.post('/api/auth/login').send({ email: googleOnlyUser.email, password: 'anypassword' });
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toMatch(/Please log in using your original method/i);
      const statusResponse = await agent.get('/api/auth/status');
      expect(statusResponse.statusCode).toBe(401);
    });
  });

  // --- Status Tests (/api/auth/status) ---
  describe('GET /api/auth/status', () => {
    const statusUserCredentials = {
      email: 'status.test@example.com',
      password: 'password123',
      name: 'Status Test User',
      role_id: 3,
    };

    it('should return user info (200 OK) when logged in', async () => {
      const agent = request.agent(app); // New agent
      const regResponse = await agent.post('/api/auth/register').send(statusUserCredentials);
      const loggedInUserId = regResponse.body.id;

      const response = await agent.get('/api/auth/status');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id', loggedInUserId);
      expect(response.body.email).toBe(statusUserCredentials.email);
      expect(response.body).not.toHaveProperty('password');
    });
    it('should return 401 Unauthorized when not logged in', async () => {
      const agent = request.agent(app); // New agent
      const response = await agent.get('/api/auth/status');
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toMatch(/Not authenticated/i);
    });
  });

  // --- Logout Tests (/api/auth/logout) ---
  describe('POST /api/auth/logout', () => {
    const logoutUserCredentials = {
      email: 'logout.test@example.com',
      password: 'password123',
      name: 'Logout Test User',
      role_id: 3,
    };

    it('should log out successfully (200 OK) when logged in', async () => {
      const agent = request.agent(app); // New agent
      await agent.post('/api/auth/register').send(logoutUserCredentials);

      const response = await agent.post('/api/auth/logout');
      expect(response.statusCode).toBe(200);
      expect(response.body.message).toMatch(/Logged out successfully/i);
      const statusResponse = await agent.get('/api/auth/status');
      expect(statusResponse.statusCode).toBe(401);
    });
    it('should return 401 Unauthorized when attempting to logout if already logged out', async () => {
      const agent = request.agent(app); // New agent
      const response = await agent.post('/api/auth/logout');
      expect(response.statusCode).toBe(401);
      expect(response.body.message).toMatch(/Not logged in/i);
    });
  });

});