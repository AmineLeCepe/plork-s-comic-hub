const multer = require('multer');

function multerErrorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', 'One or more files exceed the maximum allowed size.');
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            req.flash('error', 'Too many files uploaded in a single request.');
        } else {
            req.flash('error', err.message || 'File upload error.');
        }
        return res.redirect('back');
    }
    return next(err);
}

function notFound(req, res) {
    res.status(404).render('404');
}

function errorHandler(err, req, res, next) {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).send('Internal Server Error');
}

module.exports = { multerErrorHandler, notFound, errorHandler };