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

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => { console.log('MongoDB connected'); seedUsers(); })
        .catch(err => console.log('MongoDB error:', err.message));
} else {
    console.log('No MONGO_URI set');
}

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, lowercase: true },
    password: { type: String, required: true },
    displayName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});
messageSchema.index({ timestamp: 1 });
const Message = mongoose.model('Message', messageSchema);

async function seedUsers() {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            const h1 = await bcrypt.hash('cavity123', 10);
            const h2 = await bcrypt.hash('cingam123', 10);
            await User.create([
                { username: 'cavity', password: h1, displayName: 'Cavity' },
                { username: 'cingam', password: h2, displayName: 'Cingam' }
            ]);
            console.log('Users created');
        }
    } catch (e) { console.log('Seed:', e.message); }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ success: false, message: 'Enter both fields' });
        const user = await User.findOne({ username: username.toLowerCase().trim() });
        if (!user) return res.json({ success: false, message: 'Unknown signal' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.json({ success: false, message: 'Wrong frequency' });
        res.json({ success: true, user: { username: user.username, displayName: user.displayName } });
    } catch (e) { res.json({ success: false, message: 'Signal lost' }); }
});

// Get messages
app.get('/api/messages', async (req, res) => {
    try {
        const msgs = await Message.find({}).sort({ timestamp: 1 }).limit(1000);
        res.json({ success: true, messages: msgs });
    } catch (e) { res.json({ success: true, messages: [] }); }
});

// Unread count
app.get('/api/unread/:username', async (req, res) => {
    try {
        const count = await Message.countDocuments({ receiver: req.params.username, read: false });
        res.json({ success: true, count });
    } catch (e) { res.json({ success: true, count: 0 }); }
});

// Mark read
app.post('/api/messages/read', async (req, res) => {
    try {
        await Message.updateMany({ receiver: req.body.username, read: false }, { $set: { read: true } });
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket
const onlineUsers = {};

io.on('connection', (socket) => {
    socket.on('user-online', (username) => {
        onlineUsers[username] = socket.id;
        socket.username = username;
        io.emit('online-status', Object.keys(onlineUsers));
    });

    socket.on('send-message', async (data) => {
        try {
            const msg = await Message.create({
                sender: data.sender,
                receiver: data.receiver,
                message: data.message
            });
            const msgObj = msg.toObject();
            // To receiver
            if (onlineUsers[data.receiver]) {
                io.to(onlineUsers[data.receiver]).emit('receive-message', msgObj);
            }
            // Confirm to sender
            socket.emit('message-sent', msgObj);
        } catch (e) {
            socket.emit('message-error', 'Failed');
        }
    });

    socket.on('typing', (data) => {
        if (onlineUsers[data.receiver]) {
            io.to(onlineUsers[data.receiver]).emit('partner-typing', true);
        }
    });
    socket.on('stop-typing', (data) => {
        if (onlineUsers[data.receiver]) {
            io.to(onlineUsers[data.receiver]).emit('partner-typing', false);
        }
    });
    socket.on('messages-read', (data) => {
        if (onlineUsers[data.sender]) {
            io.to(onlineUsers[data.sender]).emit('partner-read');
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) delete onlineUsers[socket.username];
        io.emit('online-status', Object.keys(onlineUsers));
    });
});

server.listen(PORT, () => console.log('Silent Signal on port ' + PORT));
