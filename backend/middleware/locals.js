module.exports = function locals() {
    return (req, res, next) => {
        res.locals.user = req.user || null;
        res.locals.error = req.flash('error');
        res.locals.success = req.flash('success');
        next();
    };
};