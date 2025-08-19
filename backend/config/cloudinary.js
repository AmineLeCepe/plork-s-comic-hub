// JavaScript
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Ensure all uploads via this storage are stored as webp with lower quality
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'comic_thumbnails',
    resource_type: 'image',
    format: 'webp',
    quality: 'auto:eco',
    public_id: `${file.fieldname}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  })
});

module.exports = { cloudinary, storage };

// Extract Cloudinary public_id (with folder) from a full delivery URL
function extractPublicIdFromUrl(url) {
  try {
    if (!url || typeof url !== 'string') return null;
    // Matches: .../upload/v<ver>/<folder>/<name>.<ext> OR .../upload/<folder>/<name>.<ext>
    const m = url.match(/\/upload\/(?:v\d+\/)?([^?#.]+)(?:\.[a-z0-9]+)?/i);
    return m && m[1] ? m[1] : null;
  } catch {
    return null;
  }
}

// Delete a list of Cloudinary resources given their delivery URLs
async function deleteCloudinaryResourcesByUrls(urls) {
  const candidates = Array.isArray(urls) ? urls : [];
  const publicIds = candidates
    .map(extractPublicIdFromUrl)
    .filter(Boolean);

  if (publicIds.length === 0) return { deleted: [], failed: [] };

  const deleted = [];
  const failed = [];

  // Cloudinary API accepts up to 1000 ids per call; we’ll batch conservatively
  const chunkSize = 100;
  for (let i = 0; i < publicIds.length; i += chunkSize) {
    const chunk = publicIds.slice(i, i + chunkSize);
    try {
      const res = await cloudinary.api.delete_resources(chunk);
      // res.deleted is an object: { 'folder/name': 'deleted' | 'not_found' | 'error' }
      Object.entries(res.deleted || {}).forEach(([id, status]) => {
        if (status === 'deleted') deleted.push(id);
        else failed.push({ id, status });
      });
    } catch (err) {
      // If the whole batch failed, mark each as failed
      chunk.forEach((id) => failed.push({ id, status: err?.message || 'error' }));
    }
  }

  return { deleted, failed };
}

// Export helpers without changing existing exports
module.exports.extractPublicIdFromUrl = extractPublicIdFromUrl;
module.exports.deleteCloudinaryResourcesByUrls = deleteCloudinaryResourcesByUrls;