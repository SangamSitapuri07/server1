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

if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => { console.log('MongoDB connected'); seedData(); })
        .catch(err => console.log('MongoDB error:', err.message));
}

// ═══ SCHEMAS ═══
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, lowercase: true },
    password: String, displayName: String
}));
const Message = mongoose.model('Message', new mongoose.Schema({
    sender: String, receiver: String, message: String,
    timestamp: { type: Date, default: Date.now }, read: { type: Boolean, default: false }
}));
const Letter = mongoose.model('Letter', new mongoose.Schema({
    sender: String, receiver: String, title: String, content: String,
    mood: { type: String, default: '💕' },
    timestamp: { type: Date, default: Date.now }, read: { type: Boolean, default: false }
}));
const Confession = mongoose.model('Confession', new mongoose.Schema({
    author: String, content: String, mood: { type: String, default: '💭' },
    timestamp: { type: Date, default: Date.now },
    hearts: { type: Number, default: 0 }, heartedBy: [String]
}));
const Quote = mongoose.model('Quote', new mongoose.Schema({
    addedBy: String, quote: String, author: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    hearts: { type: Number, default: 0 }, heartedBy: [String]
}));
const Song = mongoose.model('Song', new mongoose.Schema({
    title: String, artist: { type: String, default: '' },
    url: String, addedBy: String,
    timestamp: { type: Date, default: Date.now }
}));
const Memory = mongoose.model('Memory', new mongoose.Schema({
    title: String, description: String, date: String,
    mood: { type: String, default: '💕' }, addedBy: String,
    timestamp: { type: Date, default: Date.now }
}));
const Meme = mongoose.model('Meme', new mongoose.Schema({
    imageUrl: String, caption: { type: String, default: '' },
    addedBy: String, timestamp: { type: Date, default: Date.now },
    hearts: { type: Number, default: 0 }, heartedBy: [String]
}));

async function seedData() {
    try {
        if (await User.countDocuments() === 0) {
            const h1 = await bcrypt.hash('cavity123', 10);
            const h2 = await bcrypt.hash('cingam123', 10);
            await User.create([
                { username: 'cavity', password: h1, displayName: 'Cavity' },
                { username: 'cingam', password: h2, displayName: 'Cingam' }
            ]);
            console.log('Users created');
        }
        if (await Quote.countDocuments() === 0) {
            await Quote.insertMany([
                { addedBy: 'system', quote: 'Every love story is beautiful, but ours is my favorite' },
                { addedBy: 'system', quote: 'In a sea of people, my eyes will always search for you' },
                { addedBy: 'system', quote: 'You are my today and all of my tomorrows', author: 'Leo Christopher' },
                { addedBy: 'system', quote: 'I fell in love the way you fall asleep: slowly, then all at once', author: 'John Green' },
                { addedBy: 'system', quote: 'My heart is and always will be yours', author: 'Jane Austen' },
                { addedBy: 'system', quote: 'You are my sun, my moon, and all my stars', author: 'E.E. Cummings' },
                { addedBy: 'system', quote: 'Together is my favorite place to be' },
                { addedBy: 'system', quote: 'Some hearts understand each other even in silence' },
                { addedBy: 'system', quote: 'I choose you. And I will choose you over and over' },
                { addedBy: 'system', quote: 'Whatever our souls are made of, his and mine are the same', author: 'Emily Bronte' },
                { addedBy: 'system', quote: 'If I know what love is, it is because of you', author: 'Hermann Hesse' },
                { addedBy: 'system', quote: 'To love and be loved is to feel the sun from both sides', author: 'David Viscott' }
            ]);
            console.log('Quotes seeded');
        }
    } catch (e) { console.log('Seed:', e.message); }
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// AUTH
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ success: false, message: 'Enter both fields' });
        const user = await User.findOne({ username: username.toLowerCase().trim() });
        if (!user) return res.json({ success: false, message: 'Unknown signal' });
        if (!await bcrypt.compare(password, user.password)) return res.json({ success: false, message: 'Wrong frequency' });
        res.json({ success: true, user: { username: user.username, displayName: user.displayName } });
    } catch (e) { res.json({ success: false, message: 'Signal lost' }); }
});

// MESSAGES
app.get('/api/messages', async (req, res) => { try { res.json({ success: true, messages: await Message.find({}).sort({ timestamp: 1 }).limit(1000) }); } catch (e) { res.json({ success: true, messages: [] }); } });
app.get('/api/unread/:u', async (req, res) => { try { res.json({ success: true, count: await Message.countDocuments({ receiver: req.params.u, read: false }) }); } catch (e) { res.json({ success: true, count: 0 }); } });
app.post('/api/messages/read', async (req, res) => { try { await Message.updateMany({ receiver: req.body.username, read: false }, { read: true }); res.json({ success: true }); } catch (e) { res.json({ success: false }); } });

// LETTERS
app.post('/api/letters', async (req, res) => { try { const l = await Letter.create(req.body); res.json({ success: true, letter: l }); } catch (e) { res.json({ success: false }); } });
app.get('/api/letters/:u', async (req, res) => { try { res.json({ success: true, letters: await Letter.find({ $or: [{ sender: req.params.u }, { receiver: req.params.u }] }).sort({ timestamp: -1 }) }); } catch (e) { res.json({ success: true, letters: [] }); } });
app.post('/api/letters/open', async (req, res) => { try { await Letter.findByIdAndUpdate(req.body.id, { read: true }); res.json({ success: true }); } catch (e) { res.json({ success: false }); } });
app.get('/api/letters/unread/:u', async (req, res) => { try { res.json({ success: true, count: await Letter.countDocuments({ receiver: req.params.u, read: false }) }); } catch (e) { res.json({ success: true, count: 0 }); } });

// CONFESSIONS
app.post('/api/confessions', async (req, res) => { try { res.json({ success: true, confession: await Confession.create(req.body) }); } catch (e) { res.json({ success: false }); } });
app.get('/api/confessions', async (req, res) => { try { res.json({ success: true, confessions: await Confession.find({}).sort({ timestamp: -1 }).limit(200) }); } catch (e) { res.json({ success: true, confessions: [] }); } });
app.post('/api/confessions/heart', async (req, res) => {
    try {
        const c = await Confession.findById(req.body.id);
        if (c.heartedBy.includes(req.body.username)) { c.hearts--; c.heartedBy = c.heartedBy.filter(u => u !== req.body.username); }
        else { c.hearts++; c.heartedBy.push(req.body.username); }
        await c.save(); res.json({ success: true, hearts: c.hearts, hearted: c.heartedBy.includes(req.body.username) });
    } catch (e) { res.json({ success: false }); }
});

// QUOTES
app.get('/api/quotes', async (req, res) => { try { res.json({ success: true, quotes: await Quote.find({}).sort({ timestamp: -1 }) }); } catch (e) { res.json({ success: true, quotes: [] }); } });
app.post('/api/quotes', async (req, res) => { try { res.json({ success: true, quote: await Quote.create(req.body) }); } catch (e) { res.json({ success: false }); } });
app.post('/api/quotes/heart', async (req, res) => {
    try {
        const q = await Quote.findById(req.body.id);
        if (q.heartedBy.includes(req.body.username)) { q.hearts--; q.heartedBy = q.heartedBy.filter(u => u !== req.body.username); }
        else { q.hearts++; q.heartedBy.push(req.body.username); }
        await q.save(); res.json({ success: true, hearts: q.hearts, hearted: q.heartedBy.includes(req.body.username) });
    } catch (e) { res.json({ success: false }); }
});

// SONGS
app.get('/api/songs', async (req, res) => { try { res.json({ success: true, songs: await Song.find({}).sort({ timestamp: -1 }) }); } catch (e) { res.json({ success: true, songs: [] }); } });
app.post('/api/songs', async (req, res) => { try { res.json({ success: true, song: await Song.create(req.body) }); } catch (e) { res.json({ success: false }); } });
app.delete('/api/songs/:id', async (req, res) => { try { await Song.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.json({ success: false }); } });

// MEMORIES
app.get('/api/memories', async (req, res) => { try { res.json({ success: true, memories: await Memory.find({}).sort({ date: -1 }) }); } catch (e) { res.json({ success: true, memories: [] }); } });
app.post('/api/memories', async (req, res) => { try { res.json({ success: true, memory: await Memory.create(req.body) }); } catch (e) { res.json({ success: false }); } });

// MEMES
app.get('/api/memes', async (req, res) => { try { res.json({ success: true, memes: await Meme.find({}).sort({ timestamp: -1 }) }); } catch (e) { res.json({ success: true, memes: [] }); } });
app.post('/api/memes', async (req, res) => { try { res.json({ success: true, meme: await Meme.create(req.body) }); } catch (e) { res.json({ success: false }); } });
app.post('/api/memes/heart', async (req, res) => {
    try {
        const m = await Meme.findById(req.body.id);
        if (m.heartedBy.includes(req.body.username)) { m.hearts--; m.heartedBy = m.heartedBy.filter(u => u !== req.body.username); }
        else { m.hearts++; m.heartedBy.push(req.body.username); }
        await m.save(); res.json({ success: true, hearts: m.hearts, hearted: m.heartedBy.includes(req.body.username) });
    } catch (e) { res.json({ success: false }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// SOCKET
const onlineUsers = {};
io.on('connection', (socket) => {
    socket.on('user-online', u => { onlineUsers[u] = socket.id; socket.username = u; io.emit('online-status', Object.keys(onlineUsers)); });
    socket.on('send-message', async d => {
        try { const m = await Message.create({ sender: d.sender, receiver: d.receiver, message: d.message });
        if (onlineUsers[d.receiver]) io.to(onlineUsers[d.receiver]).emit('receive-message', m.toObject());
        socket.emit('message-sent', m.toObject()); } catch (e) {}
    });
    socket.on('typing', d => { if (onlineUsers[d.receiver]) io.to(onlineUsers[d.receiver]).emit('partner-typing', true); });
    socket.on('stop-typing', d => { if (onlineUsers[d.receiver]) io.to(onlineUsers[d.receiver]).emit('partner-typing', false); });
    socket.on('messages-read', d => { if (onlineUsers[d.sender]) io.to(onlineUsers[d.sender]).emit('partner-read'); });
    socket.on('letter-sent', d => { if (onlineUsers[d.receiver]) io.to(onlineUsers[d.receiver]).emit('new-letter', d); });
    socket.on('confession-posted', () => socket.broadcast.emit('new-confession'));
    socket.on('meme-posted', () => socket.broadcast.emit('new-meme'));
    socket.on('memory-posted', () => socket.broadcast.emit('new-memory'));
    socket.on('song-added', () => socket.broadcast.emit('new-song'));
    socket.on('disconnect', () => { if (socket.username) delete onlineUsers[socket.username]; io.emit('online-status', Object.keys(onlineUsers)); });
});

server.listen(PORT, () => console.log('Silent Signal on port ' + PORT));
