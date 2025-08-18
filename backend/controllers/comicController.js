const Chapter = require('../models/Chapter');
const Comic = require('../models/Comic');

// Fetch latest chapters for homepage
async function latestReleasesGet(req, res, next) {
  try {
    const latestChapters = await Chapter.find({})
      .sort({ releaseDate: -1 })
      .limit(30)
      .populate('comic')
      .lean();

    return res.render('index', { latestChapters });
  } catch (err) {
    return next(err);
  }
}

// Existing chapter view counter logic
async function chapterGet(req, res, next) {
  try {
    const chapterId = req.params?.id || req.query?.id || req.query?.chapterid;

    if (!chapterId) {
      return res.status(400).send('Missing chapter id');
    }

    // Increment chapter views
    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      { $inc: { 'stats.views': 1 } },
      { new: true }
    );

    if (!updatedChapter) {
      return res.status(404).send('Chapter not found');
    }

    // Recompute comic total views from all its chapters
    if (updatedChapter.comic) {
      const agg = await Chapter.aggregate([
        { $match: { comic: updatedChapter.comic } },
        { $group: { _id: '$comic', totalViews: { $sum: '$stats.views' } } },
      ]);
      const totalViews = agg?.[0]?.totalViews ?? 0;

      await Comic.updateOne(
        { _id: updatedChapter.comic },
        { $set: { 'stats.views': totalViews } }
      );
    }

    // Fetch the full chapter (with comic populated) for rendering
    const chapter = await Chapter.findById(chapterId).populate('comic').lean();
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }

    // Render existing reader view with required data
    return res.render('read-comic', { comic: chapter.comic, chapter });

  } catch (err) {
    return next(err);
  }
}

module.exports = {
  latestReleasesGet,
  chapterGet,
};