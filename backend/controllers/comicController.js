const models = require('../models');

async function chapterGet(req, res) {
    try {
        const chapterId = req.query.chapterid;
        if (!chapterId) {
            req.flash?.('error', 'Missing chapter id.');
            return res.redirect('/');
        }

        const chapter = await models.Chapter.findById(chapterId).populate('comic', 'title _id');
        if (!chapter) {
            return res.status(404).render('404');
        }

        return res.render('read-comic', {
            chapter,
            comic: chapter.comic || null,
        });
    } catch (err) {
        console.error('[GET /chapter] error:', err);
        return res.status(500).send('Failed to load chapter.');
    }
}

module.exports = { chapterGet };