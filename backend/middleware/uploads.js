const multer = require('multer');
const { MAX_UPLOAD_MB, MAX_PAGES } = require('../config/constants');

const imageFilter = (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb(new Error('Invalid file type. Only image files are allowed.'));
    }
    cb(null, true);
};

const coverUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
    fileFilter: imageFilter,
});

const pagesUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_UPLOAD_MB * 1024 * 1024,
        files: MAX_PAGES,
    },
    fileFilter: imageFilter,
});

module.exports = { coverUpload, pagesUpload };