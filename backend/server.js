// JavaScript
// Dependencies
const express = require('express');
const path = require('path');
const connectDB = require('./config/mongodb');
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const flash = require('connect-flash');
const configPassport = require('./config/passport');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
// Remove storage import and unused upload instance to avoid side effects
// const { storage } = require('./config/cloudinary');
// const upload = multer({storage});
const { cloudinary } = require('./config/cloudinary'); // <-- Make sure this is present
const { google } = require('googleapis');
const { ensureAuthenticated, forwardAuthenticated } = require('./middleware/auth');
require('dotenv').config();
// JavaScript
// Add with other requires at the top
const sharp = require('sharp');

// Database imports
const models = require('./models');
const queries = require('./queries');


// App config
const app = express();
connectDB();

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session and Passport setup - fix the order and configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true, // Change this to true for login sessions
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        httpOnly: true
    }
}));

// Initialize Passport (correct order is important)
app.use(passport.initialize());
app.use(passport.session());

// 2. Use flash middleware
app.use(flash());

// Configure passport strategies
configPassport(app);

// AFTER passport setup, add the user and flash messages to res.locals
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.error = req.flash('error'); // For passport-local error messages
    next();
});


app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${process.env.PORT || 3000}`);
    console.log('MAX_PAGE_UPLOAD_MB=', process.env.MAX_UPLOAD_MB);

})


// Forgot password config

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    process.env.OAUTH_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.OAUTH_REFRESH_TOKEN
});

async function sendPasswordResetEmail(email, resetUrl) {
    try {
        const accessToken = await oauth2Client.getAccessToken();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.EMAIL_USER,
                clientId: process.env.OAUTH_CLIENT_ID,
                clientSecret: process.env.OAUTH_CLIENT_SECRET,
                refreshToken: process.env.OAUTH_REFRESH_TOKEN,
                accessToken: accessToken
            }
        });

        const mailOptions = {
            to: email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset',
            html: `<body style="font-family: 'Inter', sans-serif; background-color: #f1f1f1; padding: 20px;">
                       <div style="background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                           <p style="font-size: 16px; color: #333;">You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
                           <p style="font-size: 16px; color: #333;">Please click on the following link, or paste this into your browser to complete the process:</p>
                           <a href="${resetUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">${resetUrl}</a>
                           <p style="font-size: 16px; color: #333;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
                       </div>
                   </body>`
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
}


// Routes
/// Get
app.get("/", (req, res) => {
    res.render("index");
})

app.get("/profile", ensureAuthenticated,(req, res) => {
    res.render("profile");
})

app.get("/signup", forwardAuthenticated, (req, res) => {
    res.render("signup");
})

app.get("/login", forwardAuthenticated, (req, res) => {
    res.render("login");
})

app.get("/forgot-password", (req, res) => {
    res.render("forgot-password");
})

app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
})

app.get('/manage-uploads', ensureAuthenticated, async (req, res) => {
    try {
        const authorId = req.user._id;
        const result = await queries.comicQueries.getComicsByAuthor(authorId);

        if (result.success) {
            // Pass the fetched comics to the EJS template
            res.render('manage-uploads', { myUploads: result.comics });
        } else {
            // If there's an error, show a message and render with no comics
            req.flash('error', result.error);
            res.render('manage-uploads', { myUploads: [] });
        }
    } catch (error) {
        console.error('Failed to load the uploads page:', error);
        req.flash('error', 'An unexpected error occurred while loading your uploads.');
        // Redirect to the homepage as a fallback
        res.redirect('/');
    }
});

app.get('/manage-uploads/comic/:id', async (req, res) => {
    try {
        // Populate author and chapters (chapters sorted by chapterNumber ascending)
        const comic = await models.Comic.findById(req.params.id)
            .populate('author', 'username') // only need username
            .populate({
                path: 'chapters',
                options: { sort: { chapterNumber: 1 } } // show chapters in order
            });

        if (comic) {
            res.render('comic-detail', { comic });
        } else {
            res.status(404).render('404');
        }
    } catch (error) {
        console.error('Error fetching comic details:', error);
        res.status(500).send("Error loading comic page.");
    }
});



app.get('/reset-password/:token', async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await models.User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }

        res.render('reset-password', { token: req.params.token }); // Render a reset password form
    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/forgot-password');
    }
});

// Debug route to check authentication status
app.get('/debug-auth', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.user ? {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email
        } : null,
        session: req.session
    });
});

// Temporary routes for OAuth2

// app.get('/get-oauth2-token', async (req, res) => {
//     const oauth2Client = new OAuth2(
//         process.env.OAUTH_CLIENT_ID,
//         process.env.OAUTH_CLIENT_SECRET,
//         process.env.OAUTH_REDIRECT_URI
//     );
//
//     const authUrl = oauth2Client.generateAuthUrl({
//         access_type: 'offline',
//         scope: ['https://mail.google.com/'],
//     });
//
//     console.log('Authorize this app by visiting this url: ', authUrl);
//     res.send(`Authorize this app by visiting this url:  <a href="${authUrl}">Authorize</a>`);
// });
//
// app.get('/oauth2/callback', async (req, res) => {
//     const code = req.query.code;
//     const oauth2Client = new OAuth2(
//         process.env.OAUTH_CLIENT_ID,
//         process.env.OAUTH_CLIENT_SECRET,
//         process.env.OAUTH_REDIRECT_URI
//     );
//
//     try {
//         const tokenResponse = await oauth2Client.getToken(code);
//         const refreshToken = tokenResponse.tokens.refresh_token;
//         console.log('Refresh Token:', refreshToken);
//         res.send('Refresh token has been logged to the console.  Please set it as an environment variable.');
//     } catch (e) {
//         console.log('Error getting tokens: ', e);
//         res.send('Error getting tokens.');
//     }
// });

/// Post

app.post("/register", async (req, res) => {
    console.log(req.body);
    const { username, email, password, confirmPassword, birthDate, 'g-recaptcha-response': recaptchaResponse } = req.body;

    // Basic validation
    if (!username || !email || !password || !confirmPassword || !birthDate) {
        return res.status(400).render("signup", {
            error: "All fields are required",
            formData: { username, email }
        });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
        return res.status(400).render("signup", {
            error: "Passwords don't match",
            formData: { username, email }
        });
    }

    // reCAPTCHA validation
    const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
    try {
        const recaptchaVerifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`;
        const recaptchaResponseData = await axios.post(recaptchaVerifyUrl);
        console.log("reCAPTCHA Response:", recaptchaResponseData.data); // debugging line
        const { success } = recaptchaResponseData.data;

        if (!success) {
            return res.status(400).render("signup", {
                error: "reCAPTCHA verification failed",
                formData: { username, email }
            });
        }
    } catch (error) {
        console.error("reCAPTCHA verification error:", error);
        return res.status(500).render("signup", {
            error: "Failed to verify reCAPTCHA. Please try again.",
            formData: { username, email }
        });
    }

    // Use the addUser function from queries
    const result = await queries.userQueries.addUser({
        username,
        email,
        password,
        birthDate
    });

    if (result.success) {
        // Redirect to login page on success
        return res.redirect("/login?registered=true");
    } else {
        // Return to signup page with error message
        return res.status(400).render("signup", {
            error: result.error,
            formData: { username, email }
        });
    }
})

app.post("/login", (req, res, next) => {
    // Determine the URL to redirect to on failure.
    // 'Referer' is the page where the request originated.
    const redirectUrl = req.header('Referer') || '/login';

    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        
        // If authentication fails, flash the error and redirect back.
        if (!user) {
            req.flash('error', info.message);
            return res.redirect(redirectUrl);
        }

        // If authentication succeeds, log the user in.
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            // Redirect to the homepage on successful login.
            return res.redirect('/');
        });
    })(req, res, next);
});

app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await models.User.findOne({ email });

        if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot-password');
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash the token and save it to the user's account
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
        await user.save();

        // Create reset link
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

        // Send email
        try {
            await sendPasswordResetEmail(email, resetUrl);
            req.flash('success', `An email has been sent to ${email} with further instructions.`);
            res.redirect('/forgot-password');
        } catch (error) {
            console.error('nodemailer error: ', error);
            req.flash('error', 'Failed to send reset email. Please try again.');
            return res.redirect('/forgot-password');
        }

    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/forgot-password');
    }
});

app.post('/reset-password/:token', async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect(`/reset-password/${req.params.token}`);
        }

        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const user = await models.User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot-password');
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user's password and remove reset token fields
        user.passwordHash = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash('success', 'Password successfully updated!');
        res.redirect('/login');

    } catch (err) {
        console.error(err);
        req.flash('error', 'An error occurred. Please try again.');
        return res.redirect(`/reset-password/${req.params.token}`);
    }
});

// JavaScript
// 1) Add a dedicated memory-based uploader for the cover
const coverMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB || 10)) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Invalid file type. Only image files are allowed.'));
    }
    cb(null, true);
  }
});

// Helper: upload a single buffer to Cloudinary (store as webp)
function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'comic_thumbnails',
        resource_type: 'image',
        format: 'webp',         // store as webp
        quality: 'auto:eco',    // smaller original on Cloudinary side
        overwrite: false,
        ...options
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Create comic route (optimize -> upload -> save)
app.post('/manage-uploads/create-comic', coverMemoryUpload.single('cover'), async (req, res) => {
  try {
    if (!req.file) {
      req.flash('error', 'A cover image is required.');
      return res.redirect('/manage-uploads');
    }

    // 1) Optimize to WebP to save space
    const optimized = await sharp(req.file.buffer)
      .rotate() // respect EXIF orientation
      .resize({ width: 1600, withoutEnlargement: true }) // cap width for covers
      .webp({ quality: 75 }) // balanced quality for good savings
      .toBuffer();

    // 2) Upload to Cloudinary with a unique public_id
    const uniquePublicId = `cover_${req.user._id}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const uploadRes = await uploadBufferToCloudinary(optimized, { public_id: uniquePublicId });

    const coverUrl = uploadRes?.secure_url;
    if (!coverUrl) {
      req.flash('error', 'Upload succeeded but no URL was returned from Cloudinary.');
      return res.redirect('/manage-uploads');
    }

    // 3) Save to DB
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
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      nsfw: !!req.body.nsfw,
      paywalled: !!req.body.paywalled
    };

    const result = await queries.comicQueries.addComic(comicData);
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
});

// javascript
// Add/replace these sections in server.js (place before your 404 handler)

// 1) Multer memory uploader for pages (adjust limits as needed)
const pagesMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // per-file size limit (MB -> bytes)
    fileSize: (Number(process.env.MAX_UPLOAD_MB || 10)) * 1024 * 1024,
    // max number of files allowed in a single request
    files: Number(process.env.MAX_PAGES || 100)
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Invalid file type. Only image files are allowed.'));
    }
    cb(null, true);
  }
});

// 2) Helper to upload optimized buffer to Cloudinary (re-uses existing uploadBufferToCloudinary shape)
function uploadOptimizedPageToCloudinary(buffer, options = {}) {
  // Force folder and format by default; merge with caller options
  return uploadBufferToCloudinary(buffer, {
    folder: 'comic_pages',
    resource_type: 'image',
    format: 'webp',
    quality: 'auto:good',
    ...options
  });
}

// 3) Route: accept multipart, compress (sharp) each file, upload to Cloudinary, persist chapter
app.post('/manage-uploads/create-chapter',
  ensureAuthenticated,
  pagesMemoryUpload.array('pages'), // name matches your input (multiple)
  async (req, res) => {
    try {
      console.log('[create-chapter] incoming request by user:', req.user?._id);

      // Basic validation of body fields
      const { title, chapterNumber, description, releaseDate } = req.body;
      if (!title || !chapterNumber || !releaseDate) {
        req.flash('error', 'Title, chapter number and release date are required.');
        return res.redirect('back');
      }

      if (!Array.isArray(req.files) || req.files.length === 0) {
        req.flash('error', 'Please attach at least one page image.');
        return res.redirect('back');
      }

      // Process files sequentially or in limited concurrency to avoid memory spike.
      // Here we do a small concurrency pool (3 at a time). Adjust as needed.
      const CONCURRENCY = Number(process.env.PAGE_PROCESS_CONCURRENCY || 3);
      const fileQueue = [...req.files];
      const uploadedPageUrls = [];

      async function processFile(file, index) {
        // Convert/optimize using sharp
        const optimizedBuffer = await sharp(file.buffer)
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true }) // cap width
          .webp({ quality: 80 }) // tune quality
          .toBuffer();

        const publicId = `comic_${req.body.comicId || 'unknown'}_chap_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${index}`;
        const uploadRes = await uploadOptimizedPageToCloudinary(optimizedBuffer, { public_id: publicId });
        if (!uploadRes || !uploadRes.secure_url) {
          throw new Error('Cloudinary did not return a URL for an uploaded page.');
        }
        return uploadRes.secure_url;
      }

      // Limited concurrency runner
      async function runQueue() {
        const workers = new Array(CONCURRENCY).fill(null).map(async () => {
          while (fileQueue.length) {
            const file = fileQueue.shift();
            const idx = uploadedPageUrls.length; // order preserved by pushing in sequence
            const url = await processFile(file, idx);
            uploadedPageUrls.push(url);
          }
        });
        await Promise.all(workers);
      }

      await runQueue();

      // Build chapter object (adjust shape to your schema)
      // JavaScript
      // get comicId up-front
      const comicId = req.body.comicId || req.body.comic || req.query.comicId;
      if (!comicId) {
        req.flash('error', 'No comic id supplied.');
        return res.redirect('back');
      }

      // fetch comic early so we can validate before creating chapter
      const comic = await models.Comic.findById(comicId);
      if (!comic) {
        req.flash('error', 'Comic not found.');
        return res.redirect('/manage-uploads');
      }

      // Build chapter data and include the comic ref
      const chapterData = {
        title: String(title).trim(),
        chapterNumber: Number(chapterNumber),
        description: description ? String(description).trim() : '',
        releaseDate: new Date(releaseDate),
        pages: uploadedPageUrls.map(u => String(u)), // ensure strings
        nsfw: !!req.body.nsfw,
        paywalled: !!req.body.paywalled,
        createdAt: new Date(),
        author: req.user?._id,
        comic: comic._id // required field
      };

      // create chapter document
      const chapterDoc = await models.Chapter.create(chapterData);

      // reference the chapter from the comic (assumes Comic.chapters is ObjectId[] refs)
      comic.chapters = comic.chapters || [];
      comic.chapters.push(chapterDoc._id);
      await comic.save();

      req.flash('success', 'Chapter created successfully.');
      return res.redirect(`/manage-uploads/comic/${comic._id}`);
    } catch (err) {
      console.error('[create-chapter] error:', err);
      // If multer threw a MulterError it will be caught by the global multer error handler below,
      // but we handle other errors here to provide feedback.
      req.flash('error', err.message || 'Failed to create chapter.');
      return res.redirect(`/manage-uploads/comic/${comic._id}`);
    }
  }
);

// 4) Multer error handler middleware (place after routes but before 404)
// This sends a friendly message when Multer limits are hit.
app.use((err, req, res, next) => {
  if (err && err instanceof multer.MulterError) {
    console.warn('[multer error]', err.code, err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('error', `One or more files exceed the max allowed size (${process.env.MAX_PAGE_UPLOAD_MB || 10} MB).`);
      return res.redirect('back');
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      req.flash('error', 'Too many files uploaded in a single request.');
      return res.redirect('back');
    }
    // generic multer error
    req.flash('error', err.message || 'File upload error.');
    return res.redirect('back');
  }
  // Not a multer error, pass along
  return next(err);
});
/// 404 error handler

app.use((req, res) => {
    res.status(404).render('404');
});