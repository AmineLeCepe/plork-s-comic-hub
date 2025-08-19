const Chapter = require('../models/Chapter');
const Comic = require('../models/Comic');
// ... existing code ...
// Import Cloudinary cleanup helper from your cloudinary module
const { deleteCloudinaryResourcesByUrls } = require('../config/cloudinary');
const Comment = require('../models/Comment'); // add

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

    // Fetch comments for this chapter
    const comments = await Comment.find({ chapter: chapterId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .lean();

    // Render existing reader view with required data
    return res.render('read-comic', { comic: chapter.comic, chapter, comments });

  } catch (err) {
    return next(err);
  }
}

// ... existing code ...

// Define: update chapter title (required by routes and export)
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

    // Only the comic author can edit
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

// Define: delete chapter + Cloudinary cleanup (required by routes and export)
async function deleteChapterPost(req, res, next) {
  try {
    const chapterId = req.params.id;

    const chapter = await Chapter.findById(chapterId).populate('comic', '_id author');
    if (!chapter) {
      req.flash('error', 'Chapter not found.');
      return res.redirect('back');
    }

    // Only the comic author can delete
    if (req.user && chapter.comic?.author?.toString && chapter.comic.author.toString() !== req.user._id.toString()) {
      req.flash('error', 'You are not allowed to delete this chapter.');
      return res.redirect('back');
    }

    const comicId = chapter.comic?._id;
    const pageUrls = Array.isArray(chapter.pages) ? chapter.pages.slice() : [];

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

    // Best-effort Cloudinary cleanup
    if (pageUrls.length) {
      try {
        const result = await deleteCloudinaryResourcesByUrls(pageUrls);
        if (result.failed && result.failed.length) {
          req.flash('info', `Chapter deleted, but some images could not be removed from Cloudinary (${result.failed.length}).`);
        }
      } catch (err) {
        console.error('[deleteChapterPost] cloudinary cleanup error:', err);
        req.flash('info', 'Chapter deleted, but images might not have been removed from Cloudinary.');
      }
    }

    req.flash('success', 'Chapter deleted.');
    const fallback = comicId ? `/manage-uploads/comic/${comicId}` : '/';
    return res.redirect(req.get('Referer') || fallback);
  } catch (err) {
    return next(err);
  }
}

// Add: create a new comment under a chapter
async function addChapterCommentPost(req, res, next) {
  try {
    if (!req.user) {
      req.flash('error', 'Please sign in to comment.');
      return res.redirect('back');
    }

    const text = String(req.body?.text || '').trim();
    const chapterId = String(req.body?.chapterId || '').trim();
    const comicId = String(req.body?.comicId || '').trim() || null;

    if (!chapterId) {
      req.flash('error', 'Missing chapter ID.');
      return res.redirect('back');
    }
    if (!text) {
      req.flash('error', 'Comment cannot be empty.');
      return res.redirect('back');
    }

    // Ensure chapter exists
    const chapter = await Chapter.findById(chapterId).select('_id comic');
    if (!chapter) {
      req.flash('error', 'Chapter not found.');
      return res.redirect('back');
    }

    // Create comment
    await Comment.create({
      user: req.user._id,
      chapter: chapterId,
      comic: comicId || chapter.comic || undefined,
      text
    });

    // Increment stats
    await Chapter.updateOne({ _id: chapterId }, { $inc: { 'stats.comments': 1 } });
    if (comicId || chapter.comic) {
      await Comic.updateOne({ _id: comicId || chapter.comic }, { $inc: { 'stats.comments': 1 } }).catch(() => {});
    }

    req.flash('success', 'Comment posted.');
    return res.redirect(req.get('Referer') || `/chapter?chapterid=${chapterId}`);
  } catch (err) {
    return next(err);
  }
}

// Define: delete chapter + Cloudinary cleanup (required by routes and export)
async function deleteChapterPost(req, res, next) {
  try {
    const chapterId = req.params.id;

    const chapter = await Chapter.findById(chapterId).populate('comic', '_id author');
    if (!chapter) {
      req.flash('error', 'Chapter not found.');
      return res.redirect('back');
    }

    // Only the comic author can delete
    if (req.user && chapter.comic?.author?.toString && chapter.comic.author.toString() !== req.user._id.toString()) {
      req.flash('error', 'You are not allowed to delete this chapter.');
      return res.redirect('back');
    }

    const comicId = chapter.comic?._id;
    const pageUrls = Array.isArray(chapter.pages) ? chapter.pages.slice() : [];

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

    // Best-effort Cloudinary cleanup
    if (pageUrls.length) {
      try {
        const result = await deleteCloudinaryResourcesByUrls(pageUrls);
        if (result.failed && result.failed.length) {
          req.flash('info', `Chapter deleted, but some images could not be removed from Cloudinary (${result.failed.length}).`);
        }
      } catch (err) {
        console.error('[deleteChapterPost] cloudinary cleanup error:', err);
        req.flash('info', 'Chapter deleted, but images might not have been removed from Cloudinary.');
      }
    }

    req.flash('success', 'Chapter deleted.');
    const fallback = comicId ? `/manage-uploads/comic/${comicId}` : '/';
    return res.redirect(req.get('Referer') || fallback);
  } catch (err) {
    return next(err);
  }
}

async function addChapterCommentPost(req, res, next) {
    try {
        if (!req.user) {
            req.flash('error', 'Please sign in to comment.');
            return res.redirect('back');
        }

        const text = String(req.body?.text || '').trim();
        const chapterId = String(req.body?.chapterId || '').trim();
        const comicId = String(req.body?.comicId || '').trim() || null;

        if (!chapterId) {
            req.flash('error', 'Missing chapter ID.');
            return res.redirect('back');
        }
        if (!text) {
            req.flash('error', 'Comment cannot be empty.');
            return res.redirect('back');
        }

        // Ensure chapter exists
        const chapter = await Chapter.findById(chapterId).select('_id comic');
        if (!chapter) {
            req.flash('error', 'Chapter not found.');
            return res.redirect('back');
        }

        // Create comment
        await Comment.create({
            user: req.user._id,
            chapter: chapterId,
            comic: comicId || chapter.comic || undefined,
            text
        });

        // Increment stats
        await Chapter.updateOne({ _id: chapterId }, { $inc: { 'stats.comments': 1 } });
        if (comicId || chapter.comic) {
            await Comic.updateOne({ _id: comicId || chapter.comic }, { $inc: { 'stats.comments': 1 } }).catch(() => {});
        }

        req.flash('success', 'Comment posted.');
        return res.redirect(req.get('Referer') || `/chapter?chapterid=${chapterId}`);
    } catch (err) {
        return next(err);
    }
}


module.exports = {
  latestReleasesGet,
  chapterGet,
  // ... existing code ...
  updateChapterTitlePost,
  deleteChapterPost,
  addChapterCommentPost, // add
};