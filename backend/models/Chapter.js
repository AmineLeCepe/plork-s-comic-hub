const mongoose = require('mongoose');

const chapter = new mongoose.Schema({
    comic: { type: mongoose.Schema.Types.ObjectId, ref: 'Comic', required: true },
    title: { type: String, required: true },
    chapterNumber: { type: Number, required: true },
    description: { type: String },
    releaseDate: { type: Date, required: true },
    pages: [String], // Array of image URLs/paths
    nsfw: { type: Boolean, default: false },
    paywalled: { type: Boolean, default: false },

    stats: {
        views: { type: Number, default: 0 },
        bookmarks: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
    }
}, { timestamps: true });

const Chapter = mongoose.models.Chapter || mongoose.model("Chapter", chapter);

module.exports = mongoose.model('Chapter', chapter);
