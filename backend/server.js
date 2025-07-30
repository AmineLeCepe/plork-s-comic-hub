// Dependencies
const express = require('express');
const path = require('path');
const connectDB = require('./config/mongodb');
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
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

app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${process.env.PORT || 3000}`);
})

// Routes
/// Get
app.get("/", (req, res) => {
    res.render("index");
})

app.get("/profile", (req, res) => {
    res.render("profile");
})

app.get("/signup", (req, res) => {
    res.render("signup");
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/forgot-password", (req, res) => {
    res.render("forgot-password");
})

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