// Dependencies
const express = require('express');
const path = require('path');
const connectDB = require('./config/mongodb');
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const configPassport = require('./config/passport');
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

// Configure passport strategies
configPassport(app);

// AFTER passport setup, add the user to res.locals
app.use((req, res, next) => {
    res.locals.user = req.user || null;
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
    const { username, email, password, confirmPassword, birthDate } = req.body;

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
    // Log the correct field
    console.log("Login attempt with username:", req.body.username);
    
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true // You can enable flash messages for errors
    })(req, res, next);
});

