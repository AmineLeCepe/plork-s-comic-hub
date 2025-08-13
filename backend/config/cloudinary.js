// JavaScript
const cloudinary = require('cloudinary').v2;
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