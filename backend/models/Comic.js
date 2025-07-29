const mongoose = require('mongoose');

const comic = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tags: [String],
    cover: { type: String, required: true }, // URL or path to thumbnail
    releaseDate: { type: Date, required: true },
    synopsis: { type: String },
    nsfw: { type: Boolean, default: false },
    paywalled: { type: Boolean, default: false },

    chapters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }],

    stats: {
        views: { type: Number, default: 0 },
        bookmarks: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
    }
}, { timestamps: true });

const Comic = mongoose.models.Comic || mongoose.model("Comic", comic);

module.exports = mongoose.model('Comic', comic);
