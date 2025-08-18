const session = require('express-session');
const MongoStore = require('connect-mongo');

module.exports = function sessionMiddleware() {
    return session({
        secret: process.env.SESSION_SECRET || 'replace-me',
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
            collectionName: 'sessions'
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 30,
            httpOnly: true
        }
    });
};