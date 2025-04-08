# School Tennis Stats

A web application for managing and displaying tennis statistics for middle school, JV, and varsity teams.

## Project Structure

- `client/`: Contains frontend static files (HTML, CSS, JavaScript).
- `server/`: Contains the Node.js/Express backend application.
  - `src/`: Source code for the server.
    - `config/`: Configuration files (database, passport).
    - `controllers/`: Request handlers.
    - `middleware/`: Custom Express middleware (authentication, authorization).
    - `models/`: Database models/schemas (or ORM definitions).
    - `routes/`: API route definitions.
    - `services/`: Business logic, external API interactions.
    - `app.js`: Express application setup.
    - `server.js`: Server entry point.
  - `.env`: Environment variables (ignored by Git).
  - `package.json`: Node.js dependencies and scripts.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd School_Tennis
    ```
2.  **Install Backend Dependencies:**
    ```bash
    cd server
    npm install
    ```
3.  **Configure Environment Variables:**
    - Copy `.env.example` to `.env` (or create `.env` directly).
    - Fill in the required values:
      - `SESSION_SECRET`: A long, random string for session security.
      - `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`: Your PostgreSQL database credentials.
      - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Obtain from Google Cloud Console for Google SSO. Update `GOOGLE_CALLBACK_URL` if needed.
4.  **Database Setup:**
    - Ensure you have PostgreSQL running.
    - Create the database specified in `.env` (`DB_NAME`, e.g., `school_tennis`).
    - Apply the database schema (e.g., using a migration tool or running the SQL script provided in `database/schema.sql` - *Note: this file needs to be created*).
5.  **Run the Backend Server:**
    ```bash
    npm run dev  # For development with nodemon (auto-restarts on changes)
    # or
    npm start    # For production
    ```
6.  **Access the Application:**
    Open your web browser and navigate to `http://localhost:3000` (or the port specified in `.env`).

## TODOs / Next Steps

- Create database schema file (`database/schema.sql` or similar).
- Implement database connection pooling (`server/src/config/database.js`).
- Implement Passport.js strategies (Google OAuth, potentially local) (`server/src/config/passport.js`).
- Define database models/interaction logic (`server/src/models/` or `server/src/services/`).
- Create API routes and controllers (`server/src/routes/`, `server/src/controllers/`).
- Implement authentication middleware (`server/src/middleware/auth.js`).
- Build out frontend components and logic (`client/`).
- Add tests. 