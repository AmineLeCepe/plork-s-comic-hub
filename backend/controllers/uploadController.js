const models = require('../models');
// Use the specific module to avoid directory import issues
const comicQueries = require('../queries/comicQueries');
const { uploadBufferToCloudinary } = require('../services/cloudinaryService');
const { optimizeCover, optimizePage } = require('../services/imageService');
const { PAGE_PROCESS_CONCURRENCY } = require('../config/constants');

async function createComic(req, res) {
  try {
    if (!req.file) {
      req.flash('error', 'A cover image is required.');
      return res.redirect('/manage-uploads');
    }

    const optimized = await optimizeCover(req.file.buffer);
    const uniquePublicId = `cover_${req.user._id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const uploadRes = await uploadBufferToCloudinary(optimized, {
      folder: 'comic_thumbnails',
      format: 'webp',
      quality: 'auto:eco',
      public_id: uniquePublicId,
    });

    const coverUrl = uploadRes?.secure_url;
    if (!coverUrl) {
      req.flash('error', 'Upload succeeded but no URL was returned from Cloudinary.');
      return res.redirect('/manage-uploads');
    }

    const { title, synopsis, tags, releaseDate } = req.body;
    const release = new Date(releaseDate);
    if (Number.isNaN(release.getTime())) {
      req.flash('error', 'Invalid release date.');
      return res.redirect('/manage-uploads');
    }

    const comicData = {
      title: (title || '').trim(),
      author: req.user._id,
      cover: coverUrl,
      releaseDate: release,
      synopsis: (synopsis || '').trim(),
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      nsfw: !!req.body.nsfw,
      paywalled: !!req.body.paywalled,
    };

    const result = await comicQueries.addComic(comicData);
    if (result?.success) {
      req.flash('success', 'Comic created successfully!');
    } else {
      const errMsg = (result?.error?.message || result?.error) || 'Failed to create comic.';
      console.error('[create-comic] DB save failed:', errMsg);
      req.flash('error', typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
  } catch (err) {
    console.error('[create-comic] error:', err);
    req.flash('error', err?.message || 'An unexpected error occurred.');
  }

  return res.redirect('/manage-uploads');
}

async function createChapter(req, res) {
  try {
    const { title, chapterNumber, description, releaseDate } = req.body;
    if (!title || !chapterNumber || !releaseDate) {
      req.flash('error', 'Title, chapter number and release date are required.');
      return res.redirect('back');
    }

    if (!Array.isArray(req.files) || req.files.length === 0) {
      req.flash('error', 'Please attach at least one page image.');
      return res.redirect('back');
    }

    const fileQueue = [...req.files];
    const uploadedPageUrls = [];

    async function processFile(file, index) {
      const optimizedBuffer = await optimizePage(file.buffer);
      const publicId = `comic_${req.body.comicId || 'unknown'}_chap_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}_${index}`;
      const uploadRes = await uploadBufferToCloudinary(optimizedBuffer, {
        folder: 'comic_pages',
        format: 'webp',
        quality: 'auto:good',
        public_id: publicId,
      });
      if (!uploadRes || !uploadRes.secure_url) {
        throw new Error('Cloudinary did not return a URL for an uploaded page.');
      }
      return uploadRes.secure_url;
    }

    async function runQueue() {
      const concurrency = Math.max(1, PAGE_PROCESS_CONCURRENCY);
      const workers = new Array(concurrency).fill(null).map(async () => {
        while (fileQueue.length) {
          const file = fileQueue.shift();
          const idx = uploadedPageUrls.length;
          const url = await processFile(file, idx);
          uploadedPageUrls.push(url);
        }
      });
      await Promise.all(workers);
    }

    await runQueue();

    const comicId = req.body.comicId || req.body.comic || req.query.comicId;
    if (!comicId) {
      req.flash('error', 'No comic id supplied.');
      return res.redirect('back');
    }

    const comic = await models.Comic.findById(comicId);
    if (!comic) {
      req.flash('error', 'Comic not found.');
      return res.redirect('/manage-uploads');
    }

    const chapterData = {
      title: String(title).trim(),
      chapterNumber: Number(chapterNumber),
      description: description ? String(description).trim() : '',
      releaseDate: new Date(releaseDate),
      pages: uploadedPageUrls.map((u) => String(u)),
      nsfw: !!req.body.nsfw,
      paywalled: !!req.body.paywalled,
      createdAt: new Date(),
      author: req.user?._id,
      comic: comic._id,
    };

    const chapterDoc = await models.Chapter.create(chapterData);

    comic.chapters = comic.chapters || [];
    comic.chapters.push(chapterDoc._id);
    await comic.save();

    req.flash('success', 'Chapter created successfully.');
    return res.redirect(`/manage-uploads/comic/${comic._id}`);
  } catch (err) {
    console.error('[create-chapter] error:', err);
    req.flash('error', err.message || 'Failed to create chapter.');
    return res.redirect('back');
  }
}

async function manageUploadsGet(req, res) {
  try {
    const authorId = req.user._id;

    // Remove the ESM dynamic import that caused ERR_UNSUPPORTED_DIR_IMPORT
    // const result = await (await import('../queries')).default;

    const r = await comicQueries.getComicsByAuthor(authorId);

    if (r.success) {
      return res.render('manage-uploads', { myUploads: r.comics });
    } else {
      req.flash('error', r.error);
      return res.render('manage-uploads', { myUploads: [] });
    }
  } catch (error) {
    console.error('Failed to load the uploads page:', error);
    req.flash('error', 'An unexpected error occurred while loading your uploads.');
    return res.redirect('/');
  }
}

async function comicDetailGet(req, res) {
  try {
    const comic = await models.Comic.findById(req.params.id)
      .populate('author', 'username')
      .populate({
        path: 'chapters',
        options: { sort: { chapterNumber: 1 } },
      });

    if (comic) {
      return res.render('comic-detail', { comic });
    }
    return res.status(404).render('404');
  } catch (error) {
    console.error('Error fetching comic details:', error);
    return res.status(500).send('Error loading comic page.');
  }
}

module.exports = {
  createComic,
  createChapter,
  manageUploadsGet,
  comicDetailGet,
};