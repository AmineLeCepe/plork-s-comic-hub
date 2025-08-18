const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.OAUTH_REFRESH_TOKEN,
});

async function sendPasswordResetEmail(email, resetUrl) {
    const accessToken = await oauth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_USER,
            clientId: process.env.OAUTH_CLIENT_ID,
            clientSecret: process.env.OAUTH_CLIENT_SECRET,
            refreshToken: process.env.OAUTH_REFRESH_TOKEN,
            accessToken,
        },
    });

    await transporter.sendMail({
        to: email,
        from: process.env.EMAIL_USER,
        subject: 'Password Reset',
        html: `<p>You requested a password reset.</p><p>Click the link to continue:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
}

module.exports = { sendPasswordResetEmail };