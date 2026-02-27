/* ============================================================
   THE SILENT SIGNAL — Signaling Server
   Ultra-minimal server for WebRTC peer connection
   Supports ONE permanent room for you and her
   ============================================================ */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*", // Allow connections from your Android app
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store connected peers in the permanent room
const PERMANENT_ROOM = "SILENT_SIGNAL_FOREVER_2026";
const connectedPeers = new Map();

// Simple health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    service: 'The Silent Signal - Signaling Server',
    connectedPeers: connectedPeers.size
  });
});

io.on('connection', (socket) => {
  console.log(`✨ New connection: ${socket.id}`);

  // Auto-join the permanent room
  socket.join(PERMANENT_ROOM);
  connectedPeers.set(socket.id, {
    joinedAt: Date.now(),
    room: PERMANENT_ROOM
  });

  // Notify the other person that partner is online
  socket.to(PERMANENT_ROOM).emit('partnerOnline', {
    peerId: socket.id,
    timestamp: Date.now()
  });

  console.log(`💕 Total peers in room: ${connectedPeers.size}`);

  // Handle WebRTC offer (from initiator)
  socket.on('offer', (data) => {
    console.log(`📤 Offer from ${socket.id}`);
    socket.to(PERMANENT_ROOM).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  // Handle WebRTC answer (from responder)
  socket.on('answer', (data) => {
    console.log(`📥 Answer from ${socket.id}`);
    socket.to(PERMANENT_ROOM).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  // Handle ICE candidates (network path discovery)
  socket.on('iceCandidate', (data) => {
    console.log(`🧊 ICE candidate from ${socket.id}`);
    socket.to(PERMANENT_ROOM).emit('iceCandidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`💔 Disconnected: ${socket.id}`);
    connectedPeers.delete(socket.id);
    
    // Notify partner that you went offline
    socket.to(PERMANENT_ROOM).emit('partnerOffline', {
      peerId: socket.id,
      timestamp: Date.now()
    });
    
    console.log(`💕 Remaining peers: ${connectedPeers.size}`);
  });

  // Heartbeat to keep connection alive
  socket.on('heartbeat', () => {
    socket.emit('heartbeat-ack');
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   THE SILENT SIGNAL - Signaling Server ║
║   Running on port ${PORT}                 ║
║   Room: ${PERMANENT_ROOM}   ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('💫 Shutting down gracefully...');
  server.close(() => {
    console.log('✨ Server closed');
    process.exit(0);
  });
});
