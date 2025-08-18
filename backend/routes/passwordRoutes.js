const express = require('express');
const router = express.Router();
const {
    forgotPasswordGet,
    forgotPasswordPost,
    resetPasswordGet,
    resetPasswordPost,
} = require('../controllers/passwordController');

router.get('/forgot-password', forgotPasswordGet);
router.post('/forgot-password', forgotPasswordPost);
router.get('/reset-password/:token', resetPasswordGet);
router.post('/reset-password/:token', resetPasswordPost);

module.exports = router;