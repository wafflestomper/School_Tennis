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
    // Returns an agent logged in as that user, and the player ID
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

        // Create a dummy team (needed for player creation)
        // Use stateless request as we only need the team ID
        const teamRes = await request(app).post('/api/teams').set('Cookie', regRes.header['set-cookie']).send({ name: `Test Team for ${emailSuffix}`});
        expect(teamRes.statusCode).toBe(201);
        const teamId = teamRes.body.id;

        // Create a player record linking the user to the team
        // Use stateless request as we only need the player ID
        const playerRes = await request(app).post('/api/players').set('Cookie', regRes.header['set-cookie']).send({ user_id: userId, team_id: teamId });
        expect(playerRes.statusCode).toBe(201);
        const playerId = playerRes.body.id;

        return { agent, userId, playerId };
    };

    it('should return 403 Forbidden when a Player tries to DELETE /api/players/:id', async () => {
        // Arrange: Create and log in as a Player (Role ID 3)
        const { agent: playerAgent, playerId } = await setupUserAndPlayer(3, 'player');

        // Act: Attempt to delete the player record using the Player's agent
        const response = await playerAgent.delete(`/api/players/${playerId}`);

        // Assert
        expect(response.statusCode).toBe(403);
        expect(response.body.message).toMatch(/Forbidden: Only Admins or Coaches/i);

        // Verify player still exists in DB
        const dbRes = await db.query('SELECT COUNT(*) FROM players WHERE id = $1', [playerId]);
        expect(parseInt(dbRes.rows[0].count, 10)).toBe(1);
    });

    it('should return 200 OK when a Coach tries to DELETE /api/players/:id', async () => {
        // Arrange: Create a player to delete, and log in as a Coach (Role ID 2)
        // We need a separate player to delete, created perhaps by a setup step or another user
        // Let's create a player first, then log in as a coach to delete them.
        const playerToDelete = await setupUserAndPlayer(3, 'deletee'); // Create a player (role 3)
        const { agent: coachAgent } = await setupUserAndPlayer(2, 'coach'); // Create/login coach (role 2)

        // Act: Attempt to delete the player record using the Coach's agent
        const response = await coachAgent.delete(`/api/players/${playerToDelete.playerId}`);

        // Assert
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('id', playerToDelete.playerId);

        // Verify player no longer exists in DB
        const dbRes = await db.query('SELECT COUNT(*) FROM players WHERE id = $1', [playerToDelete.playerId]);
        expect(parseInt(dbRes.rows[0].count, 10)).toBe(0);
    });

    it('should return 200 OK when an Admin tries to DELETE /api/players/:id', async () => {
        // Arrange: Create a player to delete, and log in as an Admin (Role ID 1)
        const playerToDelete = await setupUserAndPlayer(3, 'deletee-admin'); // Create a player (role 3)
        const { agent: adminAgent } = await setupUserAndPlayer(1, 'admin'); // Create/login admin (role 1)

        // Act: Attempt to delete the player record using the Admin's agent
        const response = await adminAgent.delete(`/api/players/${playerToDelete.playerId}`);

        // Assert
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('id', playerToDelete.playerId);

        // Verify player no longer exists in DB
        const dbRes = await db.query('SELECT COUNT(*) FROM players WHERE id = $1', [playerToDelete.playerId]);
        expect(parseInt(dbRes.rows[0].count, 10)).toBe(0);
    });

  });

});