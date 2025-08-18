const passport = require('passport');
const { verifyRecaptcha } = require('../services/recaptchaService');
const queries = require('../queries');

async function register(req, res) {
    const { username, email, password, confirmPassword, birthDate } = req.body;
    const recaptchaToken = req.body['g-recaptcha-response'];

    if (!username || !email || !password || !confirmPassword || !birthDate) {
        return res.status(400).render('signup', {
            error: 'All fields are required',
            formData: { username, email },
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).render('signup', {
            error: "Passwords don't match",
            formData: { username, email },
        });
    }

    const recaptchaOk = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaOk) {
        return res.status(400).render('signup', {
            error: 'reCAPTCHA verification failed',
            formData: { username, email },
        });
    }

    const result = await queries.userQueries.addUser({
        username,
        email,
        password,
        birthDate,
    });

    if (result.success) {
        return res.redirect('/login?registered=true');
    }

    return res.status(400).render('signup', {
        error: result.error,
        formData: { username, email },
    });
}

function login(req, res, next) {
    const redirectUrl = req.header('Referer') || '/login';
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash('error', info?.message || 'Login failed');
            return res.redirect(redirectUrl);
        }
        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            return res.redirect('/');
        });
    })(req, res, next);
}

function logout(req, res, next) {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
}

module.exports = { register, login, logout };