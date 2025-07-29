require('dotenv').config({ path: './config/.env' });
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MongoDB URI is not defined in environment variables');
        }
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');
    } catch (e) {
        console.error("Error connecting to MongoDB Atlas: ", e);
        process.exit(1); // Exit the process if database connection fails
    }
}

module.exports = connectDB;