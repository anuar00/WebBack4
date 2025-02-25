const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

router.get('/:username', async (req, res) => {
    try {
        const userProfile = await User.findOne({ username: req.params.username });
        if (!userProfile) {
            return res.status(404).send('User not found');
        }

        const blogs = await Blog.find({ username: userProfile.username }).sort({ createdAt: -1 });

        const isCurrentUser = req.session.user && req.session.user.username === userProfile.username;

        res.render('profile', { userProfile, blogs, isCurrentUser, currentUser: req.session.user, error: null });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(404).send('User not found');
        }

        if (req.file) {
            user.avatar = '/uploads/' + req.file.filename;
            await user.save();

            await Blog.updateMany({ username: user.username }, { avatar: user.avatar });

            req.session.user.avatar = user.avatar;
        }

        res.redirect('/profile/' + user.username);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});




router.post('/edit', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const user = await User.findById(req.session.user._id);
    if (!user) return res.status(404).send('User not found');

    const newUsername = req.body.username.trim();
    if (!newUsername) {
        return res.render('profile', {
            userProfile: user,
            isCurrentUser: true,
            blogs: await Blog.find({ username: user.username }).sort({ createdAt: -1 }),
            currentUser: req.session.user,
            error: "Username cannot be empty" 
        });
    }

    const oldUsername = user.username;
    user.username = newUsername;
    await user.save();
    req.session.user.username = newUsername;

    await Blog.updateMany({ username: oldUsername }, { $set: { username: newUsername } });

    res.redirect(`/profile/${newUsername}`);
});




router.post('/edit-blog/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).send('Blog not found');

        if (blog.username !== req.session.user.username && req.session.user.role !== 'admin') {
            return res.status(403).send('You are not allowed to edit this blog');
        }

        blog.content = req.body.content;
        await blog.save();

        res.redirect('/profile/' + req.session.user.username);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});


router.post('/delete-blog/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).send('Blog not found');

        if (req.session.user.role === 'admin' || blog.username === req.session.user.username) {
            await Blog.findByIdAndDelete(req.params.id);
        }

        res.redirect(`/profile/${req.session.user.username}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/delete-blog/:id', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).send('Blog not found');

        if (req.session.user.role === 'admin' || blog.username === req.session.user.username) {
            await Blog.findByIdAndDelete(req.params.id);
        } else {
            return res.status(403).send('You are not allowed to delete this blog');
        }

        res.redirect(`/profile/${req.session.user.username}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


module.exports = router;
