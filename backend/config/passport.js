const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/User');

module.exports = function(app) {
    // Local strategy for username/password authentication
    passport.use(new LocalStrategy({
        usernameField: 'username', // Use 'username' instead of 'email'
        passwordField: 'password'
    }, async (username, password, done) => { // The first argument is now 'username'
        console.log(`Passport attempting to authenticate user: ${username}`);
        try {
            // Find user by username
            const user = await User.findOne({ username: username });

            // If user not found
            if (!user) {
                console.log(`Authentication failed: User '${username}' not found.`);
                return done(null, false, { message: 'Incorrect username or password' });
            }

            // Compare password with stored hash
            const isMatch = await bcrypt.compare(password, user.passwordHash);

            if (!isMatch) {
                console.log(`Authentication failed: Incorrect password for user '${username}'.`);
                return done(null, false, { message: 'Incorrect username or password' });
            }

            // If credentials are valid, return the user object
            console.log(`Authentication successful for user: ${username}`);
            return done(null, user);
        } catch (err) {
            console.error('Error during authentication:', err);
            return done(err);
        }
    }));

    // Serialize user to store in session (no change needed here)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session (no change needed here)
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
};