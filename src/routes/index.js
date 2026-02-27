const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const importRoutes = require('./import.routes');

// Register routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/import', importRoutes);

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Genomatch API',
    version: '1.0.0',
  });
});

module.exports = router;
