const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');

router.get('/', (req, res) => res.render('index'));
router.get('/profile', ensureAuthenticated, (req, res) => res.render('profile'));
router.get('/signup', forwardAuthenticated, (req, res) => res.render('signup'));
router.get('/login', forwardAuthenticated, (req, res) => res.render('login'));

module.exports = router;