const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendPasswordResetEmail } = require('../services/emailService');
const models = require('../models');

function forgotPasswordGet(req, res) {
    res.render('forgot-password');
}

async function forgotPasswordPost(req, res) {
    const { email } = req.body;
    try {
        const user = await models.User.findOne({ email });
        if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot-password');
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        await sendPasswordResetEmail(email, resetUrl);

        req.flash('success', `An email has been sent to ${email} with further instructions.`);
        res.redirect('/forgot-password');
    } catch (err) {
        console.error('[forgot-password]', err);
        req.flash('error', 'Failed to send reset email. Please try again.');
        res.redirect('/forgot-password');
    }
}

async function resetPasswordGet(req, res) {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await models.User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }

        res.render('reset-password', { token: req.params.token });
    } catch (err) {
        console.error('[reset-password GET]', err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/forgot-password');
    }
}

async function resetPasswordPost(req, res) {
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect(`/reset-password/${req.params.token}`);
        }

        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await models.User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }

        user.passwordHash = await bcrypt.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash('success', 'Password successfully updated!');
        res.redirect('/login');
    } catch (err) {
        console.error('[reset-password POST]', err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect(`/reset-password/${req.params.token}`);
    }
}

module.exports = {
    forgotPasswordGet,
    forgotPasswordPost,
    resetPasswordGet,
    resetPasswordPost,
};