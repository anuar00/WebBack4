const mongoose = require('mongoose');

const Blog = mongoose.models.Blog || mongoose.model('Blog', new mongoose.Schema({
    username: { type: String, required: true },
    avatar: { type: String, default: '/public/uploads/default-avatar.png' },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}));

module.exports = Blog;
