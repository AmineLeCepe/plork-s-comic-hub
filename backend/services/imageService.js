const sharp = require('sharp');

async function optimizeCover(buffer) {
    return sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
}

async function optimizePage(buffer) {
    return sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
}

module.exports = { optimizeCover, optimizePage };