const multer = require('multer');

const ALLOWED_EXTENSIONS = /\.(tsv|csv)$/i;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_EXTENSIONS.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type not allowed: ${file.originalname}. Only .tsv and .csv files are accepted.`
      )
    );
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

const uploadImportFiles = upload.fields([
  { name: 'sampleDetails', maxCount: 1 },
  { name: 'alleles', maxCount: 30 },
  { name: 'consensus', maxCount: 30 },
]);

module.exports = uploadImportFiles;
