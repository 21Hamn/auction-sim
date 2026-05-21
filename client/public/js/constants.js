// client/public/js/constants.js
// Client-side constants (mirrors shared/constants.js)

const AUCTION_TYPES = {
  ENGLISH: 'english',
  DUTCH: 'dutch',
  FIRST_PRICE_SEALED: 'first_price_sealed',
  SECOND_PRICE_SEALED: 'second_price_sealed'
};

const GAME_STATES = {
  LOBBY: 'lobby',
  BIDDING: 'bidding',
  REVEAL: 'reveal',
  RESULTS: 'results',
  ENDED: 'ended'
};

const SOCKET_EVENTS = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  ROOM_ERROR: 'room_error',
  ROOM_UPDATE: 'room_update',
  PLACE_BID: 'place_bid',
  BID_UPDATE: 'bid_update',
  BID_ERROR: 'bid_error',
  AUTO_BID: 'auto_bid',
  FOLD: 'fold',
  BUY_NOW: 'buy_now',
  START_AUCTION: 'start_auction',
  AUCTION_STARTED: 'auction_started',
  AUCTION_ENDED: 'auction_ended',
  TIMER_UPDATE: 'timer_update',
  KICK_PLAYER: 'kick_player',
  PAUSE_TIMER: 'pause_timer',
  INJECT_NEWS: 'inject_news',
  CHAT_MESSAGE: 'chat_message',
  SYSTEM_MESSAGE: 'system_message',
  ANALYTICS_UPDATE: 'analytics_update',
  NOTIFICATION: 'notification',
  WINNER_ANNOUNCED: 'winner_announced'
};

const AUCTION_TYPE_LABELS = {
  english: '📈 ENGLISH AUCTION',
  dutch: '📉 DUTCH AUCTION',
  first_price_sealed: '📋 FIRST-PRICE SEALED',
  second_price_sealed: '🔒 VICKREY AUCTION'
};

const PRICE_LABELS = {
  english: 'CURRENT BID',
  dutch: 'CURRENT PRICE',
  first_price_sealed: 'BIDS SUBMITTED',
  second_price_sealed: 'BIDS SUBMITTED'
};
