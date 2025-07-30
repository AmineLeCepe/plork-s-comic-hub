// Dependencies
const express = require('express');
const path = require('path');
const connectDB = require('./config/mongodb');
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
require('dotenv').config();

// Database imports
const models = require('./models');

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
    const {username, email, password, confirmPassword} = req.body;
    if (password === confirmPassword){
        // Adds user
        // Hashes the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Creates a new user object and stores the form data with the hashed password in it
        const newUser = new models.User({
            email,
            username,
            passwordHash,
        });

        // For debugging
        console.log(newUser);

        // Redirects the user to the login page after it's created
        res.redirect("/login");
    } else {
        res.redirect("/signup");
    }
})