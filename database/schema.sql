-- database/schema.sql
-- SQL script to create the database schema for the School Tennis application

-- Drop tables in reverse order of creation to handle dependencies
DROP TABLE IF EXISTS stats;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS meets;
DROP TABLE IF EXISTS meet_formats;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS seasons;

-- Create roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL -- e.g., 'Admin', 'Coach', 'Player', 'Guest'
);

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    google_id TEXT UNIQUE, -- Nullable if local authentication is also supported
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Allow coach removal without deleting team
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create players table (linking users to teams)
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- If user is deleted, player record is removed
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL, -- Allow team removal without deleting player
    is_captain BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create seasons table
CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, -- e.g., 'Spring 2024', 'Fall 2024'
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create meet_formats table
CREATE TABLE meet_formats (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- e.g., 'High School (6S/3D, Best-of-3)'
    num_singles_lines INTEGER NOT NULL,
    num_doubles_lines INTEGER NOT NULL,
    scoring_type TEXT NOT NULL, -- e.g., 'best_of_3_sets', '8_game_pro_set'
    description TEXT,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Track who created custom formats
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create meets table (representing a team competition event)
CREATE TABLE meets (
    id SERIAL PRIMARY KEY,
    season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL,
    meet_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    team1_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    winner_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL, -- Overall meet winner
    team1_score INTEGER, -- Overall matches won
    team2_score INTEGER,
    meet_format_id INTEGER NOT NULL REFERENCES meet_formats(id) ON DELETE RESTRICT, -- Don't allow deleting format if meets use it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create matches table (representing an individual match within a meet)
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    meet_id INTEGER NOT NULL REFERENCES meets(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL, -- e.g., 1, 2 for singles; 1, 2, 3 for doubles
    line_type TEXT NOT NULL CHECK (line_type IN ('Singles', 'Doubles')),
    team1_player1_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    team1_player2_id INTEGER REFERENCES players(id) ON DELETE SET NULL, -- Null if singles
    team2_player1_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    team2_player2_id INTEGER REFERENCES players(id) ON DELETE SET NULL, -- Null if singles
    winner_code INTEGER, -- 0=In Progress, 1=Team1 Wins, 2=Team2 Wins, 3=Draw, 4=Team1 Forfeit, 5=Team2 Forfeit
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meet_id, line_number, line_type) -- Ensure unique line # within a meet for each type
);

-- Create sets table (detailed score breakdown within a match)
CREATE TABLE sets (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    team1_games_won INTEGER NOT NULL CHECK (team1_games_won >= 0),
    team2_games_won INTEGER NOT NULL CHECK (team2_games_won >= 0),
    tiebreak_score_team1 INTEGER CHECK (tiebreak_score_team1 IS NULL OR tiebreak_score_team1 >= 0), -- Null if no tiebreak played or applicable
    tiebreak_score_team2 INTEGER CHECK (tiebreak_score_team2 IS NULL OR tiebreak_score_team2 >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (match_id, set_number) -- Ensure unique set number within a match
);

-- Create stats table (detailed stats for a player within a match)
CREATE TABLE stats (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    stat_key TEXT NOT NULL, -- e.g., 'Aces', 'Double Faults', 'Winners'
    stat_value TEXT NOT NULL, -- Using TEXT for flexibility initially
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (match_id, player_id, stat_key) -- Prevent duplicate stat entries per player per match
);

-- Basic seeding for roles
INSERT INTO roles (name) VALUES ('Admin'), ('Coach'), ('Player'), ('Guest')
ON CONFLICT (name) DO NOTHING;

-- Indexes for frequent lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_meets_season_id ON meets(season_id);
CREATE INDEX idx_meets_team1_id ON meets(team1_id);
CREATE INDEX idx_meets_team2_id ON meets(team2_id);
CREATE INDEX idx_matches_meet_id ON matches(meet_id);
CREATE INDEX idx_stats_match_id ON stats(match_id);
CREATE INDEX idx_stats_player_id ON stats(player_id);

-- Optional: Trigger function to update 'updated_at' columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with 'updated_at'
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meet_formats_updated_at BEFORE UPDATE ON meet_formats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meets_updated_at BEFORE UPDATE ON meets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sets_updated_at BEFORE UPDATE ON sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- End of schema script 