// shared/constants.js
// Shared constants between server and client

const AUCTION_TYPES = {
  ENGLISH: 'english',
  DUTCH: 'dutch',
  FIRST_PRICE_SEALED: 'first_price_sealed',
  SECOND_PRICE_SEALED: 'second_price_sealed'
};

const AUCTION_THEMES = {
  OIL: 'oil',
  ART: 'art',
  SPECTRUM: 'spectrum',
  STARTUP: 'startup',
  NFT: 'nft',
  COMMODITY: 'commodity'
};

const BOT_STRATEGIES = {
  CONSERVATIVE: 'conservative',
  AGGRESSIVE: 'aggressive',
  SNIPER: 'sniper',
  IRRATIONAL: 'irrational',
  ADAPTIVE: 'adaptive'
};

const GAME_STATES = {
  LOBBY: 'lobby',
  BIDDING: 'bidding',
  REVEAL: 'reveal',
  RESULTS: 'results',
  ENDED: 'ended'
};

const SOCKET_EVENTS = {
  // Connection
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  ROOM_ERROR: 'room_error',
  ROOM_UPDATE: 'room_update',

  // Bidding
  PLACE_BID: 'place_bid',
  BID_UPDATE: 'bid_update',
  BID_ERROR: 'bid_error',
  AUTO_BID: 'auto_bid',
  FOLD: 'fold',
  BUY_NOW: 'buy_now',

  // Game flow
  START_AUCTION: 'start_auction',
  AUCTION_STARTED: 'auction_started',
  AUCTION_ENDED: 'auction_ended',
  TIMER_UPDATE: 'timer_update',
  REVEAL_BIDS: 'reveal_bids',
  NEXT_ROUND: 'next_round',

  // Host controls
  KICK_PLAYER: 'kick_player',
  PAUSE_TIMER: 'pause_timer',
  INJECT_NEWS: 'inject_news',
  TRIGGER_EVENT: 'trigger_event',

  // Chat
  CHAT_MESSAGE: 'chat_message',
  SYSTEM_MESSAGE: 'system_message',

  // Analytics
  ANALYTICS_UPDATE: 'analytics_update',

  // Notifications
  NOTIFICATION: 'notification',
  WINNER_ANNOUNCED: 'winner_announced'
};

const MAX_PLAYERS = 30;
const STARTING_BALANCE = 10000;
const MIN_BID_INCREMENT = 50;
const DUTCH_PRICE_DECREMENT_INTERVAL = 2000; // ms
const ENGLISH_BID_TIMER = 30; // seconds
const SEALED_BID_TIMER = 60; // seconds
const ANTI_SPAM_DELAY = 500; // ms

const THEME_CONFIG = {
  oil: {
    name: 'Oil Field Auction',
    emoji: '🛢️',
    description: 'Bid on offshore drilling rights',
    startPrice: 5000,
    valueRange: [3000, 15000],
    commonValueFactor: 0.7
  },
  art: {
    name: 'Fine Art Auction',
    emoji: '🎨',
    description: 'Bid on rare masterpieces',
    startPrice: 2000,
    valueRange: [1000, 20000],
    commonValueFactor: 0.3
  },
  spectrum: {
    name: 'Spectrum License Auction',
    emoji: '📡',
    description: 'Bid on radio frequency licenses',
    startPrice: 8000,
    valueRange: [5000, 25000],
    commonValueFactor: 0.8
  },
  startup: {
    name: 'Startup Valuation Auction',
    emoji: '🚀',
    description: 'Invest in the next unicorn',
    startPrice: 1000,
    valueRange: [500, 50000],
    commonValueFactor: 0.5
  },
  nft: {
    name: 'NFT Auction',
    emoji: '🖼️',
    description: 'Bid on digital collectibles',
    startPrice: 500,
    valueRange: [100, 10000],
    commonValueFactor: 0.2
  },
  commodity: {
    name: 'Commodity Futures Auction',
    emoji: '🌾',
    description: 'Bid on commodity contracts',
    startPrice: 3000,
    valueRange: [2000, 8000],
    commonValueFactor: 0.6
  }
};

if (typeof module !== 'undefined') {
  module.exports = {
    AUCTION_TYPES, AUCTION_THEMES, BOT_STRATEGIES, GAME_STATES,
    SOCKET_EVENTS, MAX_PLAYERS, STARTING_BALANCE, MIN_BID_INCREMENT,
    DUTCH_PRICE_DECREMENT_INTERVAL, ENGLISH_BID_TIMER, SEALED_BID_TIMER,
    ANTI_SPAM_DELAY, THEME_CONFIG
  };
}
