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
} else { console.log('No MONGO_URI'); }

// ═══ SCHEMAS ═══
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, lowercase: true },
    password: { type: String, required: true },
    displayName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
    sender: String, receiver: String, message: String,
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});
messageSchema.index({ timestamp: 1 });
const Message = mongoose.model('Message', messageSchema);

const letterSchema = new mongoose.Schema({
    sender: String, receiver: String,
    title: String, content: String,
    mood: { type: String, default: '💕' },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    opened: { type: Boolean, default: false }
});
letterSchema.index({ timestamp: -1 });
const Letter = mongoose.model('Letter', letterSchema);

const confessionSchema = new mongoose.Schema({
    author: String,
    content: String,
    mood: { type: String, default: '💭' },
    timestamp: { type: Date, default: Date.now },
    hearts: { type: Number, default: 0 },
    heartedBy: [String]
});
confessionSchema.index({ timestamp: -1 });
const Confession = mongoose.model('Confession', confessionSchema);

const quoteSchema = new mongoose.Schema({
    addedBy: String,
    quote: String,
    author: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    hearts: { type: Number, default: 0 },
    heartedBy: [String]
});
quoteSchema.index({ timestamp: -1 });
const Quote = mongoose.model('Quote', quoteSchema);

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
        // Seed default quotes if empty
        const qc = await Quote.countDocuments();
        if (qc === 0) {
            await Quote.insertMany([
                { addedBy: 'system', quote: 'Every love story is beautiful, but ours is my favorite', author: '' },
                { addedBy: 'system', quote: 'In a sea of people, my eyes will always search for you', author: '' },
                { addedBy: 'system', quote: 'You are my today and all of my tomorrows', author: 'Leo Christopher' },
                { addedBy: 'system', quote: 'I fell in love the way you fall asleep: slowly, then all at once', author: 'John Green' },
                { addedBy: 'system', quote: 'My heart is and always will be yours', author: 'Jane Austen' },
                { addedBy: 'system', quote: 'You are my sun, my moon, and all my stars', author: 'E.E. Cummings' },
                { addedBy: 'system', quote: 'I love you more than yesterday, less than tomorrow', author: '' },
                { addedBy: 'system', quote: 'Together is my favorite place to be', author: '' },
                { addedBy: 'system', quote: 'Some hearts understand each other even in silence', author: '' },
                { addedBy: 'system', quote: 'I choose you. And I will choose you over and over', author: '' },
                { addedBy: 'system', quote: 'You are the first and last thing on my mind each day', author: '' },
                { addedBy: 'system', quote: 'Whatever our souls are made of, his and mine are the same', author: 'Emily Bronte' },
                { addedBy: 'system', quote: 'I want all of my lasts to be with you', author: '' },
                { addedBy: 'system', quote: 'If I know what love is, it is because of you', author: 'Hermann Hesse' },
                { addedBy: 'system', quote: 'You make my heart smile', author: '' },
                { addedBy: 'system', quote: 'To love and be loved is to feel the sun from both sides', author: 'David Viscott' }
            ]);
            console.log('Quotes seeded');
        }
    } catch (e) { console.log('Seed:', e.message); }
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ═══ AUTH ═══
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

// ═══ MESSAGES ═══
app.get('/api/messages', async (req, res) => {
    try { const m = await Message.find({}).sort({ timestamp: 1 }).limit(1000); res.json({ success: true, messages: m }); }
    catch (e) { res.json({ success: true, messages: [] }); }
});
app.get('/api/unread/:username', async (req, res) => {
    try { const c = await Message.countDocuments({ receiver: req.params.username, read: false }); res.json({ success: true, count: c }); }
    catch (e) { res.json({ success: true, count: 0 }); }
});
app.post('/api/messages/read', async (req, res) => {
    try { await Message.updateMany({ receiver: req.body.username, read: false }, { $set: { read: true } }); res.json({ success: true }); }
    catch (e) { res.json({ success: false }); }
});

// ═══ LETTERS ═══
app.post('/api/letters', async (req, res) => {
    try {
        const { sender, receiver, title, content, mood } = req.body;
        if (!sender || !receiver || !content) return res.json({ success: false, message: 'Write something' });
        const letter = await Letter.create({ sender, receiver, title: title || 'Untitled Letter', content, mood: mood || '💕' });
        res.json({ success: true, letter });
    } catch (e) { res.json({ success: false, message: 'Failed to send' }); }
});
app.get('/api/letters/:username', async (req, res) => {
    try {
        const letters = await Letter.find({
            $or: [{ sender: req.params.username }, { receiver: req.params.username }]
        }).sort({ timestamp: -1 });
        res.json({ success: true, letters });
    } catch (e) { res.json({ success: true, letters: [] }); }
});
app.post('/api/letters/open', async (req, res) => {
    try {
        await Letter.findByIdAndUpdate(req.body.id, { opened: true, read: true });
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});
app.get('/api/letters/unread/:username', async (req, res) => {
    try { const c = await Letter.countDocuments({ receiver: req.params.username, read: false }); res.json({ success: true, count: c }); }
    catch (e) { res.json({ success: true, count: 0 }); }
});

// ═══ CONFESSIONS ═══
app.post('/api/confessions', async (req, res) => {
    try {
        const { author, content, mood } = req.body;
        if (!author || !content) return res.json({ success: false, message: 'Write something' });
        const conf = await Confession.create({ author, content, mood: mood || '💭' });
        res.json({ success: true, confession: conf });
    } catch (e) { res.json({ success: false, message: 'Failed' }); }
});
app.get('/api/confessions', async (req, res) => {
    try { const c = await Confession.find({}).sort({ timestamp: -1 }).limit(200); res.json({ success: true, confessions: c }); }
    catch (e) { res.json({ success: true, confessions: [] }); }
});
app.post('/api/confessions/heart', async (req, res) => {
    try {
        const { id, username } = req.body;
        const conf = await Confession.findById(id);
        if (!conf) return res.json({ success: false });
        if (conf.heartedBy.includes(username)) {
            conf.hearts = Math.max(0, conf.hearts - 1);
            conf.heartedBy = conf.heartedBy.filter(u => u !== username);
        } else {
            conf.hearts += 1;
            conf.heartedBy.push(username);
        }
        await conf.save();
        res.json({ success: true, hearts: conf.hearts, hearted: conf.heartedBy.includes(username) });
    } catch (e) { res.json({ success: false }); }
});

// ═══ QUOTES ═══
app.get('/api/quotes', async (req, res) => {
    try { const q = await Quote.find({}).sort({ timestamp: -1 }); res.json({ success: true, quotes: q }); }
    catch (e) { res.json({ success: true, quotes: [] }); }
});
app.post('/api/quotes', async (req, res) => {
    try {
        const { addedBy, quote, author } = req.body;
        if (!quote) return res.json({ success: false, message: 'Write a quote' });
        const q = await Quote.create({ addedBy, quote, author: author || '' });
        res.json({ success: true, quote: q });
    } catch (e) { res.json({ success: false, message: 'Failed' }); }
});
app.post('/api/quotes/heart', async (req, res) => {
    try {
        const { id, username } = req.body;
        const q = await Quote.findById(id);
        if (!q) return res.json({ success: false });
        if (q.heartedBy.includes(username)) {
            q.hearts = Math.max(0, q.hearts - 1);
            q.heartedBy = q.heartedBy.filter(u => u !== username);
        } else {
            q.hearts += 1;
            q.heartedBy.push(username);
        }
        await q.save();
        res.json({ success: true, hearts: q.hearts, hearted: q.heartedBy.includes(username) });
    } catch (e) { res.json({ success: false }); }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// ═══ SOCKET ═══
const onlineUsers = {};
io.on('connection', (socket) => {
    socket.on('user-online', (username) => {
        onlineUsers[username] = socket.id;
        socket.username = username;
        io.emit('online-status', Object.keys(onlineUsers));
    });
    socket.on('send-message', async (data) => {
        try {
            const msg = await Message.create({ sender: data.sender, receiver: data.receiver, message: data.message });
            const obj = msg.toObject();
            if (onlineUsers[data.receiver]) io.to(onlineUsers[data.receiver]).emit('receive-message', obj);
            socket.emit('message-sent', obj);
        } catch (e) { socket.emit('message-error', 'Failed'); }
    });
    socket.on('typing', (d) => { if (onlineUsers[d.receiver]) io.to(onlineUsers[d.receiver]).emit('partner-typing', true); });
    socket.on('stop-typing', (d) => { if (onlineUsers[d.receiver]) io.to(onlineUsers[d.receiver]).emit('partner-typing', false); });
    socket.on('messages-read', (d) => { if (onlineUsers[d.sender]) io.to(onlineUsers[d.sender]).emit('partner-read'); });

    // Letter sent notification
    socket.on('letter-sent', (d) => {
        if (onlineUsers[d.receiver]) io.to(onlineUsers[d.receiver]).emit('new-letter', d);
    });
    // Confession notification
    socket.on('confession-posted', (d) => {
        socket.broadcast.emit('new-confession', d);
    });

    socket.on('disconnect', () => {
        if (socket.username) delete onlineUsers[socket.username];
        io.emit('online-status', Object.keys(onlineUsers));
    });
});

server.listen(PORT, () => console.log('Silent Signal on port ' + PORT));
