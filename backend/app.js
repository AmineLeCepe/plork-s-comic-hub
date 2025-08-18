require('dotenv').config();
const path = require('path');
const express = require('express');
const flash = require('connect-flash');
const passport = require('passport');

const session = require('./config/session');
const configPassport = require('./config/passport');
const locals = require('./middleware/locals');
const { multerErrorHandler, notFound, errorHandler } = require('./middleware/errors');

// Routers
const viewRoutes = require('./routes/viewRoutes');
const authRoutes = require('./routes/authRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const comicRoutes = require('./routes/comicRoutes');

const app = express();

// Views and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Core middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session());

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Flash + locals
app.use(flash());
configPassport(app);
app.use(locals());

// Routes
app.use('/', viewRoutes);
app.use('/', authRoutes);
app.use('/', passwordRoutes);
app.use('/', uploadRoutes);
app.use('/', comicRoutes);

// Errors
app.use(multerErrorHandler);
app.use(notFound);
app.use(errorHandler);

module.exports = app;