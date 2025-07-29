const mongoose = require('mongoose');

const comment = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comic: { type: mongoose.Schema.Types.ObjectId, ref: 'Comic' },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    text: { type: String, required: true },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const Comment = mongoose.models.Comment || mongoose.model("Comment", comment);

module.exports = mongoose.model('Comment', comment);
