const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO - ready for chat later
io.on('connection', (socket) => {
    console.log('Connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Love App Server running on port ${PORT}`);
});