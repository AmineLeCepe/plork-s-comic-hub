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

// Securely update the title of a chapter
async function updateChapterTitlePost(req, res, next) {
  try {
    const chapterId = req.params.id;
    const newTitle = String(req.body?.title || '').trim();
    if (!newTitle) {
      req.flash('error', 'Title cannot be empty.');
      return res.redirect('back');
    }

    const chapter = await Chapter.findById(chapterId).populate('comic', 'author');
    if (!chapter) {
      req.flash('error', 'Chapter not found.');
      return res.redirect('back');
    }

    // Authorization: only the comic author can edit
    if (req.user && chapter.comic?.author?.toString && chapter.comic.author.toString() !== req.user._id.toString()) {
      req.flash('error', 'You are not allowed to edit this chapter.');
      return res.redirect('back');
    }

    chapter.title = newTitle;
    await chapter.save();

    req.flash('success', 'Chapter title updated.');
    const fallback = chapter.comic ? `/manage-uploads/comic/${chapter.comic._id}` : '/';
    return res.redirect(req.get('Referer') || fallback);
  } catch (err) {
    return next(err);
  }
}

// Securely delete a chapter and remove its reference from the comic
async function deleteChapterPost(req, res, next) {
  try {
    const chapterId = req.params.id;

    const chapter = await Chapter.findById(chapterId).populate('comic', '_id author');
    if (!chapter) {
      req.flash('error', 'Chapter not found.');
      return res.redirect('back');
    }

    // Authorization: only the comic author can delete
    if (req.user && chapter.comic?.author?.toString && chapter.comic.author.toString() !== req.user._id.toString()) {
      req.flash('error', 'You are not allowed to delete this chapter.');
      return res.redirect('back');
    }

    const comicId = chapter.comic?._id;

    await Chapter.deleteOne({ _id: chapterId });

    if (comicId) {
      await Comic.updateOne(
        { _id: comicId },
        { $pull: { chapters: chapterId } }
      );
      // Recompute comic total views after deletion
      const agg = await Chapter.aggregate([
        { $match: { comic: comicId } },
        { $group: { _id: '$comic', totalViews: { $sum: '$stats.views' } } },
      ]);
      const totalViews = agg?.[0]?.totalViews ?? 0;
      await Comic.updateOne(
        { _id: comicId },
        { $set: { 'stats.views': totalViews } }
      );
    }

    req.flash('success', 'Chapter deleted.');
    const fallback = comicId ? `/manage-uploads/comic/${comicId}` : '/';
    return res.redirect(req.get('Referer') || fallback);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  latestReleasesGet,
  chapterGet,
  updateChapterTitlePost,
  deleteChapterPost,
};