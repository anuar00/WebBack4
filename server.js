const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');
const ejs = require('ejs');
const multer = require('multer');
const fs = require('fs');
const router = express.Router();

dotenv.config();
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false
}));
app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Connection Error:', err));

const User = require('./models/User');
const Blog = require('./models/Blog');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadedPhotos = [];

app.get('/', async (req, res) => {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    ejs.renderFile(__dirname + '/views/index.ejs', {
        user: req.session.user,
        photos: uploadedPhotos,
        blogs
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
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/login');
    const users = await User.find();
    ejs.renderFile(__dirname + '/views/users.ejs', { users, currentUser: req.session.user }, (err, str) => {
        res.render('layout', { body: str, user: req.session.user });
    });
});

app.use('/profile', require('./routes/profile'));

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!email || !username || !password) {
        return res.render('register', { error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
        return res.render('register', { error: 'Username or email already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, email, password: hashedPassword });

    res.redirect('/login');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.render('login', { error: 'Invalid email or password' });
    }

    req.session.user = {
        _id: user._id,
        username: user.username,
        role: user.role,
        avatar: user.avatar
    };

    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.post('/users/delete/:id', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Access denied');

    const user = await User.findById(req.params.id);
    if (user.role === 'admin') return res.status(403).send('Cannot delete admin accounts');

    await User.findByIdAndDelete(req.params.id);
    res.redirect('/users');
});

app.post('/blogs', async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');

    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(404).send('User not found');

    const { content } = req.body;
    if (!content.trim()) return res.status(400).send('Content cannot be empty');

    await Blog.create({
        username: user.username,
        avatar: user.avatar,
        content
    });

    res.redirect('/');
});

app.post('/blogs/delete/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');

    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).send('Blog not found');

    if (req.session.user.role === 'admin' || blog.username === req.session.user.username) {
        await Blog.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } else {
        res.status(403).send('You are not allowed to delete this blog');
    }
});

app.post('/upload', upload.single('photo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const filePath = '/uploads/' + req.file.filename;
    await User.findByIdAndUpdate(req.session.user._id, { avatar: filePath });
    req.session.user.avatar = filePath;

    res.redirect('/profile');
});

app.post('/delete-photo', (req, res) => {
    const { photoPath } = req.body;
    const filePath = path.join(__dirname, 'public', photoPath);

    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).send('Error deleting photo');
        }
        const index = uploadedPhotos.indexOf(photoPath);
        if (index !== -1) {
            uploadedPhotos.splice(index, 1);
        }
        res.redirect('/');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));