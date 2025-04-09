// src/tests/authorization.test.js
const request = require('supertest');
const app = require('../../server');
const db = require('../backend/db');
const { cleanTables } = require('./setup'); // Import cleanTables

describe('Authorization Tests', () => {
  let server;
  const unauthenticatedAgent = request(app); // Use plain request for unauthenticated tests

  // Start server before tests
  beforeAll((done) => {
    server = app.listen(0, done);
  });

  // Close server after tests
  afterAll((done) => {
    server.close(done); // Only close the server
    // db.pool.end(done); // Removed pool closure
  });

  // Clean tables before each test within this file
  beforeEach(cleanTables);

  describe('Protected Route Access', () => {
    it('should return 200 OK when accessing GET /api/teams without authentication (public route)', async () => {
      const response = await unauthenticatedAgent.get('/api/teams');
      expect(response.statusCode).toBe(200);
      // We can also add an assertion that the response body is an array (even if empty)
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 200 OK when accessing GET /api/teams WITH authentication', async () => {
        const agent = request.agent(app); // New agent
        const loginCredentials = {
            email: 'auth-access@example.com',
            password: 'password123',
            name: 'Auth Access User',
            role_id: 3,
        };
        // Register user (this also logs them in via req.login)
        const regResponse = await agent.post('/api/auth/register').send(loginCredentials);
        expect(regResponse.statusCode).toBe(201); // Verify registration worked

        // Act: Access the route using the now authenticated agent
        const response = await agent.get('/api/teams');

        // Assert
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 Unauthorized when accessing POST /api/teams without authentication', async () => {
      const newTeamData = { name: 'Unauthorized Test Team' };
      const response = await unauthenticatedAgent
        .post('/api/teams')
        .send(newTeamData);
      expect(response.statusCode).toBe(401);
    });

    it('should return 201 Created when accessing POST /api/teams WITH authentication', async () => {
      const agent = request.agent(app); // New agent
      const loginCredentials = {
          email: 'post-teams-user@example.com',
          password: 'password123',
          name: 'POST Teams User',
          role_id: 3,
      };
      // Register user (this also logs them in via req.login)
      const regResponse = await agent.post('/api/auth/register').send(loginCredentials);
      expect(regResponse.statusCode).toBe(201); // Verify registration worked

      // Act: Attempt to create a team using the now authenticated agent
      const newTeamData = { name: 'Authenticated Test Team' };
      const response = await agent.post('/api/teams').send(newTeamData);

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newTeamData.name);
      // Optionally, check the database to be absolutely sure
      const dbRes = await db.query('SELECT * FROM teams WHERE id = $1', [response.body.id]);
      expect(dbRes.rows.length).toBe(1);
      expect(dbRes.rows[0].name).toBe(newTeamData.name);
    });

    // TODO: Add tests for other protected routes (PUT, DELETE for various resources)
  });

  describe('Role-Based Permissions', () => {

    // Helper function to create user and player record for tests
    // Returns an agent logged in as that user, the user ID, and the player ID
    const setupUserAndPlayer = async (roleId, emailSuffix) => {
        const agent = request.agent(app);
        const userCredentials = {
            email: `role-test-${emailSuffix}@example.com`,
            password: 'password123',
            name: `Role Test ${emailSuffix}`,
            role_id: roleId,
        };
        // Register user
        const regRes = await agent.post('/api/auth/register').send(userCredentials);
        expect(regRes.statusCode).toBe(201); // Ensure registration works
        const userId = regRes.body.id;
        const sessionCookie = regRes.header['set-cookie']; // Capture the cookie

        // Create a dummy team (needed for player creation)
        // Use stateless request with the captured cookie
        const teamRes = await request(app).post('/api/teams')
                                    .set('Cookie', sessionCookie)
                                    .send({ name: `Test Team for ${emailSuffix}`});
        if (teamRes.statusCode !== 201) {
            console.error(`Failed to create team for ${emailSuffix}. Status: ${teamRes.statusCode}, Body:`, teamRes.body);
        }
        expect(teamRes.statusCode).toBe(201);
        const teamId = teamRes.body.id;

        // Create a player record linking the user to the team
        // Use stateless request with the captured cookie
        const playerRes = await request(app).post('/api/players')
                                      .set('Cookie', sessionCookie)
                                      .send({ user_id: userId, team_id: teamId });
        if (playerRes.statusCode !== 201) {
             console.error(`Failed to create player for ${emailSuffix} (User ID: ${userId}). Status: ${playerRes.statusCode}, Body:`, playerRes.body);
        }
        expect(playerRes.statusCode).toBe(201);
        const playerId = playerRes.body.id;

        return { agent, userId, playerId }; // Return the original agent for subsequent actions in the test
    };

    it('should return 403 Forbidden when a Player tries to DELETE /api/players/:id', async () => {
        // Arrange: Create and log in as a Player (Role ID 3)
        const { agent: playerAgent, playerId } = await setupUserAndPlayer(3, 'player');

        // Act: Attempt to delete their own player record using the Player's agent
        const response = await playerAgent.delete(`/api/players/${playerId}`);

        // Assert
        expect(response.statusCode).toBe(403);
        expect(response.body.message).toMatch(/Forbidden: Only Admins or Coaches/i);

        // Verify player still exists in DB
        const dbRes = await db.query('SELECT COUNT(*) FROM players WHERE id = $1', [playerId]);
        expect(parseInt(dbRes.rows[0].count, 10)).toBe(1);
    });

    it('should return 200 OK when a Coach tries to DELETE /api/players/:id', async () => {
        // Arrange:
        // 1. Create a player to be deleted
        const { playerId: targetPlayerId, userId: targetUserId } = await setupUserAndPlayer(3, 'deletee');

        // 2. Register a Coach user and get an authenticated agent for them
        const coachAgent = request.agent(app);
        const coachCredentials = {
            email: `role-test-coach@example.com`,
            password: 'password123',
            name: `Role Test coach`,
            role_id: 2,
        };
        const coachRegRes = await coachAgent.post('/api/auth/register').send(coachCredentials);
        expect(coachRegRes.statusCode).toBe(201); // Ensure coach registration worked

        // Act: Attempt to delete the FIRST player record using the Coach's agent
        const response = await coachAgent.delete(`/api/players/${targetPlayerId}`);

        // Assert
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('id', targetPlayerId);

        // Verify player no longer exists in DB
        const dbRes = await db.query('SELECT COUNT(*) FROM players WHERE id = $1', [targetPlayerId]);
        expect(parseInt(dbRes.rows[0].count, 10)).toBe(0);
    });

    it('should return 200 OK when an Admin tries to DELETE /api/players/:id', async () => {
        // Arrange:
        // 1. Create a player to be deleted
        const { playerId: targetPlayerId, userId: targetUserId } = await setupUserAndPlayer(3, 'deletee-admin');

        // 2. Register an Admin user and get an authenticated agent for them
        const adminAgent = request.agent(app);
        const adminCredentials = {
            email: `role-test-admin@example.com`,
            password: 'password123',
            name: `Role Test admin`,
            role_id: 1,
        };
        const adminRegRes = await adminAgent.post('/api/auth/register').send(adminCredentials);
        expect(adminRegRes.statusCode).toBe(201); // Ensure admin registration worked

        // Act: Attempt to delete the FIRST player record using the Admin's agent
        const response = await adminAgent.delete(`/api/players/${targetPlayerId}`);

        // Assert
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('id', targetPlayerId);

        // Verify player no longer exists in DB
        const dbRes = await db.query('SELECT COUNT(*) FROM players WHERE id = $1', [targetPlayerId]);
        expect(parseInt(dbRes.rows[0].count, 10)).toBe(0);
    });

  });

});