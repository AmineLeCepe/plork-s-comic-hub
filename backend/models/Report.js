const mongoose = require('mongoose');

const report = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    reason: { type: String, required: true },
    reviewed: { type: Boolean, default: false }
}, { timestamps: true });

const Report = mongoose.models.Report || mongoose.model("Report", report);

module.exports = mongoose.model('Report', report);
