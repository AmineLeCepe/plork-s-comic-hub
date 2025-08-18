const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { coverUpload, pagesUpload } = require('../middleware/uploads');
const {
    createComic,
    createChapter,
    manageUploadsGet,
    comicDetailGet,
} = require('../controllers/uploadController');

router.get('/manage-uploads', ensureAuthenticated, manageUploadsGet);
router.get('/manage-uploads/comic/:id', comicDetailGet);
router.post('/manage-uploads/create-comic', ensureAuthenticated, coverUpload.single('cover'), createComic);
router.post('/manage-uploads/create-chapter', ensureAuthenticated, pagesUpload.array('pages'), createChapter);

module.exports = router;