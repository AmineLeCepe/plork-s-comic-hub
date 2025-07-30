// backend/queries/userQueries.js
const bcrypt = require('bcrypt');
const models = require('../models');

/**
 * Adds a new user to the database with validation for duplicate email and username
 * @param {Object} userData - User data containing email, username, password, and birthDate
 * @returns {Promise<Object>} - Returns a promise that resolves to an object with success status and data/error
 */
async function addUser(userData) {
    try {
        // Check if required fields are provided
        if (!userData.email || !userData.username || !userData.password || !userData.birthDate) {
            return {
                success: false,
                error: "All fields are required"
            };
        }

        // Validate birth date
        const birthDate = new Date(userData.birthDate);
        if (isNaN(birthDate.getTime())) {
            return {
                success: false,
                error: "Invalid birth date"
            };
        }

        // Check if email already exists
        const existingEmail = await models.User.findOne({ email: userData.email });
        if (existingEmail) {
            return {
                success: false,
                error: "Email already in use"
            };
        }

        // Check if username already exists
        const existingUsername = await models.User.findOne({ username: userData.username });
        if (existingUsername) {
            return {
                success: false,
                error: "Username already taken"
            };
        }

        // Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(userData.password, saltRounds);

        // Create a new user object
        const newUser = new models.User({
            email: userData.email,
            username: userData.username,
            passwordHash: passwordHash,
            birthDate: birthDate,
            // Other fields will use default values from the schema
        });

        // Save the user to database
        const savedUser = await newUser.save();

        return {
            success: true,
            data: savedUser
        };
    } catch (error) {
        console.error("Error adding user:", error);

        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return {
                success: false,
                error: messages.join(', ')
            };
        }

        return {
            success: false,
            error: "An error occurred while creating your account"
        };
    }
}

/**
 * Gets a user by email
 * @param {string} email - The email to search for
 * @returns {Promise<Object>} - The user object or null
 */
async function getUserByEmail(email) {
    return await models.User.findOne({ email });
}

/**
 * Gets a user by username
 * @param {string} username - The username to search for
 * @returns {Promise<Object>} - The user object or null
 */
async function getUserByUsername(username) {
    return await models.User.findOne({ username });
}

// Export all user-related database functions
module.exports = {
    addUser,
    getUserByEmail,
    getUserByUsername
};