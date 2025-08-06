// Dependencies
const express = require('express');
const path = require('path');
const connectDB = require('./config/mongodb');
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const flash = require('connect-flash');
const configPassport = require('./config/passport');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { storage } = require('./config/cloudinary');
const { google } = require('googleapis');
const { ensureAuthenticated, forwardAuthenticated } = require('./middleware/auth');
require('dotenv').config();

// Database imports
const models = require('./models');
const queries = require('./queries');


// App config
const app = express();
connectDB();

const upload = multer({storage});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session and Passport setup - fix the order and configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true, // Change this to true for login sessions
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        httpOnly: true
    }
}));

// Initialize Passport (correct order is important)
app.use(passport.initialize());
app.use(passport.session());

// 2. Use flash middleware
app.use(flash());

// Configure passport strategies
configPassport(app);

// AFTER passport setup, add the user and flash messages to res.locals
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.error = req.flash('error'); // For passport-local error messages
    next();
});


app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${process.env.PORT || 3000}`);
})


// Forgot password config

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.OAUTH_REFRESH_TOKEN
});

async function sendPasswordResetEmail(email, resetUrl) {
    try {
        const accessToken = await oauth2Client.getAccessToken();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.EMAIL_USER,
                clientId: process.env.OAUTH_CLIENT_ID,
                clientSecret: process.env.OAUTH_CLIENT_SECRET,
                refreshToken: process.env.OAUTH_REFRESH_TOKEN,
                accessToken: accessToken
            }
        });

        const mailOptions = {
            to: email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset',
            html: `<body style="font-family: 'Inter', sans-serif; background-color: #f1f1f1; padding: 20px;">
                       <div style="background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                           <p style="font-size: 16px; color: #333;">You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                           <p style="font-size: 16px; color: #333;">Please click on the following link, or paste this into your browser to complete the process:</p>
                           <a href="${resetUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">${resetUrl}</a>
                           <p style="font-size: 16px; color: #333;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
                       </div>
                   </body>`
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
}


// Routes
/// Get
app.get("/", (req, res) => {
    res.render("index");
})

app.get("/profile", ensureAuthenticated,(req, res) => {
    res.render("profile");
})

app.get("/signup", forwardAuthenticated, (req, res) => {
    res.render("signup");
})

app.get("/login", forwardAuthenticated, (req, res) => {
    res.render("login");
})

app.get("/forgot-password", (req, res) => {
    res.render("forgot-password");
})

app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
})

app.get('/manage-uploads', ensureAuthenticated, async (req, res) => {
    try {
        const authorId = req.user._id;
        const result = await queries.comicQueries.getComicsByAuthor(authorId);

        if (result.success) {
            // Pass the fetched comics to the EJS template
            res.render('manage-uploads', { myUploads: result.comics });
        } else {
            // If there's an error, show a message and render with no comics
            req.flash('error', result.error);
            res.render('manage-uploads', { myUploads: [] });
        }
    } catch (error) {
        console.error('Failed to load the uploads page:', error);
        req.flash('error', 'An unexpected error occurred while loading your uploads.');
        // Redirect to the homepage as a fallback
        res.redirect('/');
    }
});


app.get('/reset-password/:token', async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await models.User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }

        res.render('reset-password', { token: req.params.token }); // Render a reset password form
    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/forgot-password');
    }
});

// Debug route to check authentication status
app.get('/debug-auth', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.user ? {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email
        } : null,
        session: req.session
    });
});

// Temporary routes for OAuth2

// app.get('/get-oauth2-token', async (req, res) => {
//     const oauth2Client = new OAuth2(
//         process.env.OAUTH_CLIENT_ID,
//         process.env.OAUTH_CLIENT_SECRET,
//         process.env.OAUTH_REDIRECT_URI
//     );
//
//     const authUrl = oauth2Client.generateAuthUrl({
//         access_type: 'offline',
//         scope: ['https://mail.google.com/'],
//     });
//
//     console.log('Authorize this app by visiting this url: ', authUrl);
//     res.send(`Authorize this app by visiting this url:  <a href="${authUrl}">Authorize</a>`);
// });
//
// app.get('/oauth2/callback', async (req, res) => {
//     const code = req.query.code;
//     const oauth2Client = new OAuth2(
//         process.env.OAUTH_CLIENT_ID,
//         process.env.OAUTH_CLIENT_SECRET,
//         process.env.OAUTH_REDIRECT_URI
//     );
//
//     try {
//         const tokenResponse = await oauth2Client.getToken(code);
//         const refreshToken = tokenResponse.tokens.refresh_token;
//         console.log('Refresh Token:', refreshToken);
//         res.send('Refresh token has been logged to the console.  Please set it as an environment variable.');
//     } catch (e) {
//         console.log('Error getting tokens: ', e);
//         res.send('Error getting tokens.');
//     }
// });

/// Post

app.post("/register", async (req, res) => {
    console.log(req.body);
    const { username, email, password, confirmPassword, birthDate, 'g-recaptcha-response': recaptchaResponse } = req.body;

    // Basic validation
    if (!username || !email || !password || !confirmPassword || !birthDate) {
        return res.status(400).render("signup", {
            error: "All fields are required",
            formData: { username, email }
        });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
        return res.status(400).render("signup", {
            error: "Passwords don't match",
            formData: { username, email }
        });
    }

    // reCAPTCHA validation
    const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
    try {
        const recaptchaVerifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`;
        const recaptchaResponseData = await axios.post(recaptchaVerifyUrl);
        console.log("reCAPTCHA Response:", recaptchaResponseData.data); // debugging line
        const { success } = recaptchaResponseData.data;

        if (!success) {
            return res.status(400).render("signup", {
                error: "reCAPTCHA verification failed",
                formData: { username, email }
            });
        }
    } catch (error) {
        console.error("reCAPTCHA verification error:", error);
        return res.status(500).render("signup", {
            error: "Failed to verify reCAPTCHA. Please try again.",
            formData: { username, email }
        });
    }

    // Use the addUser function from queries
    const result = await queries.userQueries.addUser({
        username,
        email,
        password,
        birthDate
    });

    if (result.success) {
        // Redirect to login page on success
        return res.redirect("/login?registered=true");
    } else {
        // Return to signup page with error message
        return res.status(400).render("signup", {
            error: result.error,
            formData: { username, email }
        });
    }
})

app.post("/login", (req, res, next) => {
    // Determine the URL to redirect to on failure.
    // 'Referer' is the page where the request originated.
    const redirectUrl = req.header('Referer') || '/login';

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        
        // If authentication fails, flash the error and redirect back.
        if (!user) {
            req.flash('error', info.message);
            return res.redirect(redirectUrl);
        }

        // If authentication succeeds, log the user in.
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            // Redirect to the homepage on successful login.
            return res.redirect('/');
        });
    })(req, res, next);
});

app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await models.User.findOne({ email });

        if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot-password');
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash the token and save it to the user's account
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
        await user.save();

        // Create reset link
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

        // Send email
        try {
            await sendPasswordResetEmail(email, resetUrl);
            req.flash('success', `An email has been sent to ${email} with further instructions.`);
            res.redirect('/forgot-password');
        } catch (error) {
            console.error('nodemailer error: ', error);
            req.flash('error', 'Failed to send reset email. Please try again.');
            return res.redirect('/forgot-password');
        }

    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/forgot-password');
    }
});

app.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect(`/reset-password/${req.params.token}`);
        }

        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await models.User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user's password and remove reset token fields
        user.passwordHash = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash('success', 'Password successfully updated!');
        res.redirect('/login');

    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        return res.redirect(`/reset-password/${req.params.token}`);
    }
});

app.post('/manage-uploads/create-comic', upload.single('cover'), async (req, res) => {
    try {
        // 1. Check if a cover image was uploaded
        if (!req.file) {
            req.flash('error', 'A cover image is required.');
            return res.redirect('/manage-uploads');
        }

        // 2. Extract data from the request
        const { title, synopsis, tags, releaseDate } = req.body;
        const coverUrl = req.file.path; // URL from Cloudinary
        const authorId = req.user._id; // Get the logged-in user's ID

        // 3. Prepare the data for the database
        const comicData = {
            title,
            author: authorId,
            cover: coverUrl,
            releaseDate,
            synopsis: synopsis || '',
            // Split tags string into an array, trimming whitespace
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            // Checkboxes will not be in req.body if unchecked, so default to false
            nsfw: !!req.body.nsfw,
            paywalled: !!req.body.paywalled
        };

        // 4. Use the query to add the comic to the database
        const result = await queries.comicQueries.addComic(comicData);

        if (result.success) {
            req.flash('success', 'Comic created successfully!');
        } else {
            req.flash('error', result.error);
        }

    } catch (error) {
        console.error('Failed to create comic:', error);
        req.flash('error', 'An unexpected error occurred.');
    }

    res.redirect('/manage-uploads');
});

/// 404 error handler

app.use((req, res) => {
    res.status(404).render('404');
});