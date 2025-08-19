const express = require('express');
const router = express.Router();
const { chapterGet } = require('../controllers/comicController');
const { ensureAuthenticated } = require('../middleware/auth');
const {
  updateChapterTitlePost,
  deleteChapterPost
} = require('../controllers/comicController');

router.get('/chapter', chapterGet);
// Chapter management routes (secured)
router.post('/chapter/:id/title', ensureAuthenticated, updateChapterTitlePost);
router.post('/chapter/:id/delete', ensureAuthenticated, deleteChapterPost);

module.exports = router;