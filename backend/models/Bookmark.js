const mongoose = require('mongoose');

const bookmark = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comic: { type: mongoose.Schema.Types.ObjectId, ref: 'Comic' },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    createdAt: { type: Date, default: Date.now }
});

const Bookmark = mongoose.models.Bookmark || mongoose.model("Bookmark", bookmark);

module.exports = mongoose.model('Bookmark', bookmark);
