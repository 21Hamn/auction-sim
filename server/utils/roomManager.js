// server/utils/roomManager.js
// Room creation and management

const { v4: uuidv4 } = require('uuid');
const {
  GAME_STATES, MAX_PLAYERS, STARTING_BALANCE,
  AUCTION_TYPES, THEME_CONFIG
} = require('../../shared/constants');
const {
  generatePrivateValuation, generateCommonValue
} = require('./auctionEngine');

// In-memory room storage
const rooms = new Map();
const playerRooms = new Map(); // socketId -> roomCode

/**
 * Generate a unique 6-char room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

/**
 * Create a new auction room
 */
function createRoom(hostSocketId, hostName, settings = {}) {
  const code = generateRoomCode();
  const hostId = uuidv4();
  
  const room = {
    code,
    hostSocketId,
    hostId,
    settings: {
      auctionType: settings.auctionType || AUCTION_TYPES.ENGLISH,
      theme: settings.theme || 'art',
      startPrice: settings.startPrice || THEME_CONFIG[settings.theme || 'art'].startPrice,
      maxPlayers: Math.min(settings.maxPlayers || 10, MAX_PLAYERS),
      numRounds: settings.numRounds || 3,
      timerDuration: settings.timerDuration || 30,
      botsEnabled: settings.botsEnabled !== false,
      botCount: settings.botCount || 5,
      educationalMode: settings.educationalMode || false,
      dutchStartMultiplier: 2.0,
      dutchDecrement: settings.dutchDecrement || 100,
      dutchInterval: settings.dutchInterval || 2000
    },
    state: GAME_STATES.LOBBY,
    players: [],
    bots: [],
    currentRound: 0,
    currentAuction: null,
    chatHistory: [],
    auctionHistory: [],
    analytics: {
      totalRevenue: 0,
      totalRounds: 0,
      winnersCurseCount: 0,
      avgEfficiency: 0,
      revenueByType: {}
    },
    createdAt: Date.now()
  };
  
  // Add host as first player
  const host = createPlayer(hostSocketId, hostId, hostName, true);
  room.players.push(host);
  playerRooms.set(hostSocketId, code);
  
  rooms.set(code, room);
  return room;
}

/**
 * Create a player object
 */
function createPlayer(socketId, id, name, isHost = false) {
  const avatars = ['👤', '🎭', '👑', '🦊', '🐺', '🦅', '🦁', '🐯', '🦈', '🦅',
    '🤠', '🥷', '👨‍💼', '👩‍💼', '🧑‍🔬', '🧑‍💻', '🎪', '🃏', '♟️', '🎲'];
  
  return {
    socketId,
    id,
    name: sanitizeName(name),
    isHost,
    isBot: false,
    avatar: avatars[Math.floor(Math.random() * avatars.length)],
    balance: STARTING_BALANCE,
    score: 0,
    wins: 0,
    totalProfit: 0,
    bidsPlaced: 0,
    ready: false,
    connected: true,
    riskProfile: ['conservative', 'moderate', 'aggressive'][Math.floor(Math.random() * 3)],
    joinedAt: Date.now(),
    privateValuation: 0,
    lastBidTime: 0,
    currentBid: 0,
    folded: false
  };
}

/**
 * Join existing room
 */
function joinRoom(socketId, roomCode, playerName) {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.state !== GAME_STATES.LOBBY) return { error: 'Auction already in progress' };
  if (room.players.length >= room.settings.maxPlayers) return { error: 'Room is full' };
  
  // Check for duplicate name
  const existingName = room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (existingName) return { error: 'Name already taken in this room' };
  
  const playerId = uuidv4();
  const player = createPlayer(socketId, playerId, playerName);
  room.players.push(player);
  playerRooms.set(socketId, roomCode.toUpperCase());
  
  return { room, player };
}

/**
 * Remove player from room (disconnect or kick)
 */
function removePlayer(socketId) {
  const roomCode = playerRooms.get(socketId);
  if (!roomCode) return null;
  
  const room = rooms.get(roomCode);
  if (!room) return null;
  
  const playerIndex = room.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) return null;
  
  const player = room.players[playerIndex];
  
  if (room.state === GAME_STATES.LOBBY) {
    // Remove from room entirely if in lobby
    room.players.splice(playerIndex, 1);
    
    // If host left, assign new host
    if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
      room.hostSocketId = room.players[0].socketId;
    }
    
    // Clean up empty rooms
    if (room.players.length === 0) {
      rooms.delete(roomCode);
    }
  } else {
    // During auction, mark as disconnected
    player.connected = false;
  }
  
  playerRooms.delete(socketId);
  return { room, player, roomCode };
}

/**
 * Get player from socket ID
 */
function getPlayerBySocket(socketId) {
  const roomCode = playerRooms.get(socketId);
  if (!roomCode) return null;
  const room = rooms.get(roomCode);
  if (!room) return null;
  const player = room.players.find(p => p.socketId === socketId);
  return { player, room };
}

/**
 * Assign private valuations to all participants
 */
function assignValuations(room) {
  const { theme } = room.settings;
  const commonValue = generateCommonValue(theme);
  
  // Assign to human players
  for (const player of room.players) {
    player.privateValuation = generatePrivateValuation(theme, commonValue, player.riskProfile);
    player.commonValueEstimate = commonValue + Math.round((Math.random() - 0.5) * commonValue * 0.3);
    player.currentBid = 0;
    player.folded = false;
  }
  
  // Assign to bots
  for (const bot of room.bots) {
    bot.privateValuation = generatePrivateValuation(theme, commonValue, bot.riskProfile);
    bot.commonValueEstimate = commonValue + Math.round((Math.random() - 0.5) * commonValue * 0.3);
    bot.currentBid = 0;
    bot.folded = false;
  }
  
  return commonValue;
}

/**
 * Get room public state (safe to send to clients)
 */
function getRoomPublicState(room, includeValuations = false) {
  const allParticipants = [
    ...room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: false,
      isHost: p.isHost,
      balance: p.balance,
      score: p.score,
      wins: p.wins,
      ready: p.ready,
      connected: p.connected,
      bidsPlaced: p.bidsPlaced,
      currentBid: includeValuations ? p.currentBid : (room.state === GAME_STATES.BIDDING && room.settings.auctionType === 'english' ? p.currentBid : 0),
      folded: p.folded,
      privateValuation: includeValuations ? p.privateValuation : undefined
    })),
    ...room.bots.map(b => ({
      id: b.id,
      name: b.name,
      avatar: b.avatar,
      isBot: true,
      isHost: false,
      balance: b.balance,
      score: b.score,
      wins: b.wins,
      ready: true,
      connected: true,
      bidsPlaced: b.bidsPlaced,
      currentBid: 0,
      folded: b.folded
    }))
  ];
  
  return {
    code: room.code,
    state: room.state,
    settings: room.settings,
    players: allParticipants,
    currentRound: room.currentRound,
    currentAuction: room.currentAuction ? {
      ...room.currentAuction,
      // Hide sealed bids until reveal
      bids: room.state === GAME_STATES.REVEAL || room.state === GAME_STATES.RESULTS
        ? room.currentAuction.bids
        : room.settings.auctionType === AUCTION_TYPES.ENGLISH
          ? room.currentAuction.bids
          : []
    } : null,
    analytics: room.analytics
  };
}

/**
 * Get global statistics across all rooms
 */
function getGlobalStats() {
  let totalPlayers = 0;
  let activeAuctions = 0;
  let totalBids = 0;
  
  for (const room of rooms.values()) {
    totalPlayers += room.players.filter(p => p.connected).length;
    if (room.state === GAME_STATES.BIDDING) activeAuctions++;
    if (room.currentAuction) totalBids += (room.currentAuction.bids || []).length;
  }
  
  return {
    activeRooms: rooms.size,
    totalPlayers,
    activeAuctions,
    totalBids
  };
}

function sanitizeName(name) {
  return String(name).replace(/[<>&"']/g, '').trim().substring(0, 20) || 'Anonymous';
}

function getRoomByCode(code) {
  return rooms.get(code.toUpperCase());
}

function getAllRooms() {
  return Array.from(rooms.values());
}

module.exports = {
  createRoom, joinRoom, removePlayer, getPlayerBySocket,
  assignValuations, getRoomPublicState, getGlobalStats,
  getRoomByCode, getAllRooms, sanitizeName
};
