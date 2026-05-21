// server/server.js
// Main Express + Socket.IO server

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { initializeSocketHandlers } = require('./socket/socketHandlers');
const { getGlobalStats, getAllRooms } = require('./utils/roomManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

// ─────────────────────────────────────────────
// HTTP ROUTES
// ─────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.get('/api/stats', (req, res) => {
  res.json(getGlobalStats());
});

app.get('/api/rooms', (req, res) => {
  const rooms = getAllRooms().map(r => ({
    code: r.code,
    playerCount: r.players.length,
    state: r.state,
    theme: r.settings.theme,
    auctionType: r.settings.auctionType
  }));
  res.json(rooms);
});

// Serve main app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

// ─────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────

initializeSocketHandlers(io);

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = require('os').networkInterfaces();
  let localIP = 'localhost';
  
  Object.values(networkInterfaces).forEach(nets => {
    nets.forEach(net => {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
      }
    });
  });

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║         🔨 AUCTION SIM - Real-time Bidding Platform  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Local:    http://localhost:${PORT}                      ║`);
  console.log(`║  Network:  http://${localIP}:${PORT}                 ║`);
  console.log('║  Max Players: 30 per room                            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] Shutting down...');
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };
