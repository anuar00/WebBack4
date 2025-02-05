// Import dependencies
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');
const ejs = require('ejs');
const multer = require('multer');
const fs = require('fs');

dotenv.config();
const app = express();

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false
}));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Connection Error:', err));

// User Model
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
}));

// Image Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadedPhotos = []; // Store uploaded photo paths

// Routes
app.get('/', (req, res) => {
    ejs.renderFile(__dirname + '/views/index.ejs', { 
        user: req.session.user, 
        photos: uploadedPhotos 
    }, (err, str) => {
        res.render('layout', { body: str, user: req.session.user });
    });
});

app.get('/login', (req, res) => {
    ejs.renderFile(__dirname + '/views/login.ejs', {}, (err, str) => {
        res.render('layout', { body: str, user: req.session.user });
    });
});

app.get('/register', (req, res) => {
    ejs.renderFile(__dirname + '/views/register.ejs', {}, (err, str) => {
        res.render('layout', { body: str, user: req.session.user });
    });
});

app.get('/users', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const users = await User.find();
    ejs.renderFile(__dirname + '/views/users.ejs', { users }, (err, str) => {
        res.render('layout', { body: str, user: req.session.user });
    });
});

// Form validation function
function validateForm(username, password) {
    if (!username || !password) return 'All fields are required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
}

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const error = validateForm(username, password);
    if (error) return res.render('register', { error });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.render('register', { error: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashedPassword });
    res.redirect('/login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.render('login', { error: 'Invalid credentials' });
    }
    req.session.user = user;
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.post('/users/delete/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/users');
});

// Image Upload Route
app.post('/upload', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const filePath = '/uploads/' + req.file.filename;
    uploadedPhotos.push(filePath);
    res.redirect('/');
});

app.post('/delete-photo', (req, res) => {
    const { photoPath } = req.body;
    const filePath = path.join(__dirname, 'public', photoPath);
    
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).send('Error deleting photo');
        }
        // Remove the photo from the `uploadedPhotos` array
        const index = uploadedPhotos.indexOf(photoPath);
        if (index !== -1) {
            uploadedPhotos.splice(index, 1);
        }
        res.redirect('/');
    });
});


// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
