const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sample.controller');
const authenticate = require('../middlewares/auth.middleware');

router.get('/', authenticate, sampleController.listSamples);
router.get('/:id', authenticate, sampleController.getSampleById);

module.exports = router;
