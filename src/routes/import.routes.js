const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth.middleware');
const uploadImportFiles = require('../middlewares/upload.middleware');
const importController = require('../controllers/import.controller');

// POST /api/v1/import/run — requires JWT + multipart files
router.post(
  '/run',
  authenticate,
  uploadImportFiles,
  importController.importRun
);

module.exports = router;
