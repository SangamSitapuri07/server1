const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// MongoDB
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('MongoDB connected'))
        .catch(err => console.log('MongoDB error:', err.message));
} else {
    console.log('No MONGO_URI set');
}

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['boy', 'girl'], required: true, unique: true },
    displayName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role, displayName } = req.body;
        if (!username || !password || !role || !displayName) {
            return res.json({ success: false, message: 'All fields are required' });
        }
        const roleExists = await User.findOne({ role });
        if (roleExists) return res.json({ success: false, message: 'This role is already taken' });
        const userExists = await User.findOne({ username: username.toLowerCase() });
        if (userExists) return res.json({ success: false, message: 'Username already exists' });
        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({ username: username.toLowerCase(), password: hash, role, displayName });
        res.json({ success: true, user: { username: user.username, role: user.role, displayName: user.displayName } });
    } catch (err) {
        res.json({ success: false, message: 'Something went wrong' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ success: false, message: 'Enter username and password' });
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.json({ success: false, message: 'User not found' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.json({ success: false, message: 'Wrong password' });
        res.json({ success: true, user: { username: user.username, role: user.role, displayName: user.displayName } });
    } catch (err) {
        res.json({ success: false, message: 'Something went wrong' });
    }
});

// SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Online tracking
const onlineUsers = {};
io.on('connection', (socket) => {
    console.log('Connected:', socket.id);
    socket.on('user-online', (role) => {
        onlineUsers[role] = socket.id;
        io.emit('online-status', Object.keys(onlineUsers));
    });
    socket.on('disconnect', () => {
        for (let role in onlineUsers) {
            if (onlineUsers[role] === socket.id) delete onlineUsers[role];
        }
        io.emit('online-status', Object.keys(onlineUsers));
    });
});

server.listen(PORT, () => console.log('Love App running on port ' + PORT));
