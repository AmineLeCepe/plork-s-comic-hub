require('dotenv').config();
const connectDB = require('./config/mongodb');
const app = require('./app');
const { MAX_UPLOAD_MB } = require('./config/constants');

const PORT = process.env.PORT || 3000;

(async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Listening on port ${PORT}`);
        console.log('MAX_PAGE_UPLOAD_MB=', MAX_UPLOAD_MB);
    });
})();