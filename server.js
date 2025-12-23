const app = require('./src/app');
const config = require('./config/env');
const db = require('./src/models');

const PORT = config.port;

// Test database connection
db.sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection established successfully.');

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${config.env}`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
