const User = require('../models/User');

// Update logged-in user's profile picture (avatars 1..8)
exports.updateProfilePicture = async (req, res) => {
    console.log('updateProfilePicture called with:', req.body); // Add this line
    try {
        const { pfp } = req.body;
        const num = parseInt(pfp, 10);

        if (!Number.isInteger(num) || num < 1 || num > 8) {
            return res.status(400).send('Invalid avatar selection.');
        }

        await User.updateOne({ _id: req.user._id }, { $set: { pfp: num } });

        return res.redirect('/profile');
    } catch (err) {
        console.error('Failed to update profile picture:', err);
        return res.status(500).send('Something went wrong while updating the profile picture.');
    }
};
