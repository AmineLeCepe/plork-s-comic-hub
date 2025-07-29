const mongoose = require('mongoose');

const viewHistory = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
    viewedAt: { type: Date, default: Date.now }
});

const ViewHistory = mongoose.models.ViewHistory || mongoose.model("ViewHistory", viewHistory);

module.exports = mongoose.model('ViewHistory', viewHistory);
