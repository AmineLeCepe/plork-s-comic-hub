const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.post('/picture', ensureAuthenticated, userController.updateProfilePicture);

module.exports = router;