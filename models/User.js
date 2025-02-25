const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true }, 
    password: { type: String, required: true },
    avatar: { type: String, default: '/uploads/default-avatar.png' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

