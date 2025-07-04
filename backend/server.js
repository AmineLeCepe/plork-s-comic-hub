// Dependencies
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${process.env.PORT || 3000}`);
})

app.get("/", (req, res) => {
    res.render("index");
})