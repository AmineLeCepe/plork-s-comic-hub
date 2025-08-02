const mongoose = require('mongoose');

const report = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    birthDate: { type: Date, required: true },

    pfp: { type: Number, enum: [1, 2, 3, 4], default: 1 }, // pick from static 4

    roles: {
        isUser: { type: Boolean, default: true },
        isModerator: { type: Boolean, default: false },
        isAuthor: { type: Boolean, default: false },
        isAdmin: { type: Boolean, default: false },
    },

    socialLinks: {
        patreon: { type: String },
        twitter: { type: String },
        discord: { type: String },
    },

    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bookmark' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readingHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ViewHistory' }],
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
}, { timestamps: true });


const User = mongoose.models.User || mongoose.model("User", report);

module.exports = mongoose.model('User', report);