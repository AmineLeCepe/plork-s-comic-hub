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
const { ensureAuthenticated, forwardAuthenticated } = require('./middleware/auth');
require('dotenv').config();

// Database imports
const models = require('./models');
const queries = require('./queries');


// App config
const app = express();
connectDB();

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

/// 404 error handler

app.use((req, res) => {
    res.status(404).render('404');
});