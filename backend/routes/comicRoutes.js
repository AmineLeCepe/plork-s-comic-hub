const express = require('express');
const router = express.Router();
const { chapterGet } = require('../controllers/comicController');

router.get('/chapter', chapterGet);

module.exports = router;