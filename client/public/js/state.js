// client/public/js/state.js
// Global application state

const AppState = {
  // Connection
  socket: null,
  connected: false,

  // Player
  myId: null,
  myName: '',
  isHost: false,

  // Room
  room: null,
  roomCode: '',

  // Auction
  currentAuction: null,
  privateValuation: 0,
  commonEstimate: 0,
  riskProfile: 'moderate',
  timerDuration: 60,
  hasSubmittedSealedBid: false,
  autoBidMax: 0,
  currentTimerInterval: null,
  timerStartTime: null,
  timerOriginalDuration: 60,

  // Analytics
  lastAnalytics: null,

  // UI
  currentPage: 'landing'
};

// Convenience getters
function getMyPlayer() {
  if (!AppState.room || !AppState.myId) return null;
  return AppState.room.players.find(p => p.id === AppState.myId);
}

function isMyAuction() {
  return AppState.room && AppState.isHost;
}

function getActivePlayers() {
  if (!AppState.room) return [];
  return AppState.room.players.filter(p => p.connected !== false);
}

function getAllParticipants() {
  if (!AppState.room) return [];
  return AppState.room.players;
}

function getSortedLeaderboard() {
  if (!AppState.room) return [];
  return [...AppState.room.players]
    .sort((a, b) => (b.balance + b.score) - (a.balance + a.score));
}
