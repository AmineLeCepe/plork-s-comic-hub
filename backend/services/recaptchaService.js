const axios = require('axios');

async function verifyRecaptcha(token) {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) return false;
    try {
        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', token || '');

        const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 8000,
        });

        return Boolean(data && data.success);
    } catch (e) {
        console.error('[reCAPTCHA] verify error:', e.message);
        return false;
    }
}

module.exports = { verifyRecaptcha };