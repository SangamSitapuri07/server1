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
        .then(() => { console.log('MongoDB connected'); seedUsers(); })
        .catch(err => console.log('MongoDB error:', err.message));
} else {
    console.log('No MONGO_URI set');
}

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, lowercase: true },
    password: { type: String, required: true },
    displayName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Auto-create the 2 users on first run
async function seedUsers() {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            const hash1 = await bcrypt.hash('cavity123', 10);
            const hash2 = await bcrypt.hash('cingam123', 10);
            await User.create([
                { username: 'cavity', password: hash1, displayName: 'Cavity' },
                { username: 'cingam', password: hash2, displayName: 'Cingam' }
            ]);
            console.log('Users created: cavity & cingam');
        } else {
            console.log('Users already exist');
        }
    } catch (e) {
        console.log('Seed error:', e.message);
    }
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Login only
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ success: false, message: 'Enter username and password' });
        const user = await User.findOne({ username: username.toLowerCase().trim() });
        if (!user) return res.json({ success: false, message: 'Unknown signal detected' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.json({ success: false, message: 'Wrong frequency' });
        res.json({ success: true, user: { username: user.username, displayName: user.displayName } });
    } catch (err) {
        res.json({ success: false, message: 'Signal lost. Try again.' });
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

    socket.on('user-online', (username) => {
        onlineUsers[username] = socket.id;
        socket.username = username;
        io.emit('online-status', Object.keys(onlineUsers));
    });

    socket.on('disconnect', () => {
        if (socket.username && onlineUsers[socket.username]) {
            delete onlineUsers[socket.username];
        }
        io.emit('online-status', Object.keys(onlineUsers));
    });
});

server.listen(PORT, () => console.log('The Silent Signal running on port ' + PORT));
