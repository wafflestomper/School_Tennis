require('dotenv').config(); // Load environment variables from .env file
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  // TODO: Add database connection health check here
}); 