// src/tests/sets.test.js
const request = require('supertest');
const app = require('../../server');
const db = require('../backend/db');
const { cleanTables } = require('./setup'); // Import cleanTables

describe('Sets API - /api/matches/:matchId/sets & /api/sets/:id', () => {
    let server;
    const unauthenticatedAgent = request(app);

    // Test setup data
    let testUser, testTeam1, testTeam2, testPlayer1, testPlayer2, testMeet, testMatch;
    let loggedInAgent; // Will hold agent logged in as testUser

    // Start server before tests
    beforeAll(async (done) => {
        server = app.listen(0, done);
    });

    // Close server after tests
    afterAll(async (done) => {
        server.close(done);
    });

    // Clean tables before each test
    beforeEach(async () => {
        await cleanTables();

        // --- Setup common data needed for most set tests ---
        loggedInAgent = request.agent(app); // Create a fresh agent for each test run

        // 1. Create a User (e.g., a Coach)
        const userRes = await loggedInAgent.post('/api/auth/register').send({
            email: 'set-tester@example.com',
            password: 'password123',
            name: 'Set Tester',
            role_id: 2, // Coach role
        });
        expect(userRes.statusCode).toBe(201);
        testUser = userRes.body;

        // 2. Create two Teams
        const team1Res = await loggedInAgent.post('/api/teams').send({ name: 'Set Test Team 1', coach_id: testUser.id });
        expect(team1Res.statusCode).toBe(201);
        testTeam1 = team1Res.body;

        const team2Res = await loggedInAgent.post('/api/teams').send({ name: 'Set Test Team 2' });
        expect(team2Res.statusCode).toBe(201);
        testTeam2 = team2Res.body;

        // 3. Create Players (linking users to teams - need other users or reuse testUser?)
        // For simplicity, let's create dummy users/players directly for now
        // Player 1 (on Team 1)
        const p1UserRes = await db.query(
            `INSERT INTO users (email, name, role_id) VALUES ($1, $2, $3) RETURNING id`,
            ['player1-sets@example.com', 'Player One Sets', 3] // Role 3 = Player
        );
        const p1PlayerRes = await db.query(
            `INSERT INTO players (user_id, team_id) VALUES ($1, $2) RETURNING id`,
            [p1UserRes.rows[0].id, testTeam1.id]
        );
        testPlayer1 = { id: p1PlayerRes.rows[0].id, user_id: p1UserRes.rows[0].id, team_id: testTeam1.id };

        // Player 2 (on Team 2)
        const p2UserRes = await db.query(
            `INSERT INTO users (email, name, role_id) VALUES ($1, $2, $3) RETURNING id`,
            ['player2-sets@example.com', 'Player Two Sets', 3]
        );
        const p2PlayerRes = await db.query(
            `INSERT INTO players (user_id, team_id) VALUES ($1, $2) RETURNING id`,
            [p2UserRes.rows[0].id, testTeam2.id]
        );
        testPlayer2 = { id: p2PlayerRes.rows[0].id, user_id: p2UserRes.rows[0].id, team_id: testTeam2.id };

        // 4. Create a Meet Format (Need one to create a Meet)
        const formatRes = await db.query(
            `INSERT INTO meet_formats (name, num_singles_lines, num_doubles_lines, scoring_type) VALUES ($1, $2, $3, $4) RETURNING id`,
            ['Test Format Sets', 6, 3, 'best_of_3_sets']
        );
        const testFormatId = formatRes.rows[0].id;


        // 5. Create a Meet
        const meetRes = await loggedInAgent.post('/api/meets').send({
            season_id: null, // Optional for now
            meet_date: new Date().toISOString(),
            team1_id: testTeam1.id,
            team2_id: testTeam2.id,
            meet_format_id: testFormatId,
        });
        expect(meetRes.statusCode).toBe(201);
        testMeet = meetRes.body;

        // 6. Create a Match within the Meet
        const matchRes = await loggedInAgent.post('/api/matches').send({
            meet_id: testMeet.id,
            line_number: 1,
            line_type: 'Singles',
            team1_player1_id: testPlayer1.id,
            team2_player1_id: testPlayer2.id,
        });
        expect(matchRes.statusCode).toBe(201);
        testMatch = matchRes.body;
        // --- End Setup ---
    });


    describe('POST /api/matches/:matchId/sets', () => {
        it('should create a new set for a match successfully', async () => {
            const newSetData = {
                set_number: 1,
                team1_games_won: 6,
                team2_games_won: 4,
                // Optional tiebreak scores: tiebreak_score_team1: null, tiebreak_score_team2: null
            };

            const response = await loggedInAgent
                .post(`/api/matches/${testMatch.id}/sets`)
                .send(newSetData);

            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body.match_id).toBe(testMatch.id);
            expect(response.body.set_number).toBe(newSetData.set_number);
            expect(response.body.team1_games_won).toBe(newSetData.team1_games_won);
            expect(response.body.team2_games_won).toBe(newSetData.team2_games_won);

            // Verify in DB
            const dbRes = await db.query('SELECT * FROM sets WHERE id = $1', [response.body.id]);
            expect(dbRes.rows.length).toBe(1);
            expect(dbRes.rows[0].match_id).toBe(testMatch.id);
            expect(dbRes.rows[0].set_number).toBe(newSetData.set_number);
        });

        it('should return 400 for invalid set data (e.g., missing fields)', async () => {
            const response = await loggedInAgent
                .post(`/api/matches/${testMatch.id}/sets`)
                .send({ set_number: 1 }); // Missing game scores
            expect(response.statusCode).toBe(400);
        });

         it('should return 400 for duplicate set_number within the same match', async () => {
            // Arrange: Create set 1 first
             const setData = { set_number: 1, team1_games_won: 6, team2_games_won: 3 };
             await loggedInAgent.post(`/api/matches/${testMatch.id}/sets`).send(setData);

            // Act: Try to create set 1 again
            const response = await loggedInAgent.post(`/api/matches/${testMatch.id}/sets`).send(setData);

            // Assert: Expect conflict or bad request based on route handling
            // Need to check setRoutes.js for how duplicate set_number is handled
            expect(response.statusCode).toBe(409); // Assuming 409 Conflict for UNIQUE constraint
            expect(response.body.message).toMatch(/Set number \d+ already exists/i);
        });

        it('should return 401 if not authenticated', async () => {
             const newSetData = { set_number: 1, team1_games_won: 6, team2_games_won: 4 };
             const response = await unauthenticatedAgent
                 .post(`/api/matches/${testMatch.id}/sets`)
                 .send(newSetData);
             expect(response.statusCode).toBe(401);
         });

        // TODO: Add more validation tests (negative scores, invalid matchId etc.)
    });

    describe('GET /api/matches/:matchId (including sets)', () => {
        it('should return the match details including associated sets', async () => {
            // Arrange: Create a couple of sets for the testMatch
             await loggedInAgent.post(`/api/matches/${testMatch.id}/sets`).send({ set_number: 1, team1_games_won: 6, team2_games_won: 2 });
             await loggedInAgent.post(`/api/matches/${testMatch.id}/sets`).send({ set_number: 2, team1_games_won: 7, team2_games_won: 5 });

            // Act: Fetch the match
            const response = await loggedInAgent.get(`/api/matches/${testMatch.id}`);

            // Assert
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('id', testMatch.id);
            expect(response.body).toHaveProperty('sets');
            expect(Array.isArray(response.body.sets)).toBe(true);
            expect(response.body.sets.length).toBe(2);
            expect(response.body.sets[0]).toHaveProperty('set_number', 1);
            expect(response.body.sets[0]).toHaveProperty('team1_games_won', 6);
            expect(response.body.sets[1]).toHaveProperty('set_number', 2);
            expect(response.body.sets[1]).toHaveProperty('team2_games_won', 5);
        });

        // TODO: Test GET /api/matches/:matchId for a match with NO sets
    });

    describe('PUT /api/sets/:id', () => {
        // TODO: Test updating a set
        // TODO: Test updating a non-existent set (404)
        // TODO: Test updating with invalid data (400)
        // TODO: Test updating requires authentication (401)
        // TODO: Test role restrictions if any (e.g., 403)
    });

    describe('DELETE /api/sets/:id', () => {
        // TODO: Test deleting a set
        // TODO: Test deleting a non-existent set (404)
        // TODO: Test deleting requires authentication (401)
        // TODO: Test role restrictions if any (e.g., 403)
    });

});