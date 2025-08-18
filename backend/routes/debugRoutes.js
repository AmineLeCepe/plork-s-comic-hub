const express = require('express');
const router = express.Router();

router.get('/debug-auth', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.user
            ? {
                id: req.user._id,
                username: req.user.username,
                email: req.user.email,
            }
            : null,
        session: req.session,
    });
});

module.exports = router;