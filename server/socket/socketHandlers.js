// server/socket/socketHandlers.js
// All Socket.IO event handlers

const {
  SOCKET_EVENTS, GAME_STATES, AUCTION_TYPES,
  ANTI_SPAM_DELAY, MIN_BID_INCREMENT, THEME_CONFIG
} = require('../../shared/constants');
const {
  createRoom, joinRoom, removePlayer, getPlayerBySocket,
  assignValuations, getRoomPublicState, getGlobalStats,
  getRoomByCode, sanitizeName
} = require('../utils/roomManager');
const {
  determineAuctionResult, analyzeBidDistribution,
  calculateEfficiency, calculateExpectedRevenue,
  nashEquilibriumBid, calculateBidderSurplus
} = require('../utils/auctionEngine');
const {
  fillWithBots, calculateBotBid, shouldBotBuyDutch, generateSealedBid
} = require('../utils/botManager');

// Track active timers per room
const roomTimers = new Map();
const botIntervals = new Map();

function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // ─────────────────────────────────────────────
    // ROOM MANAGEMENT
    // ─────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ roomCode, playerName, createNew, settings }) => {
      try {
        playerName = sanitizeName(playerName || 'Anonymous');
        
        if (createNew) {
          const room = createRoom(socket.id, playerName, settings || {});
          socket.join(room.code);
          socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
            room: getRoomPublicState(room),
            playerId: room.players[0].id,
            isHost: true
          });
          io.emit('global_stats', getGlobalStats());
          console.log(`[ROOM] Created room ${room.code} by ${playerName}`);
        } else {
          const result = joinRoom(socket.id, roomCode, playerName);
          if (result.error) {
            socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: result.error });
            return;
          }
          const { room, player } = result;
          socket.join(room.code);
          
          socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
            room: getRoomPublicState(room),
            playerId: player.id,
            isHost: false
          });
          
          // Notify others
          socket.to(room.code).emit(SOCKET_EVENTS.ROOM_UPDATE, {
            room: getRoomPublicState(room),
            notification: `${player.name} joined the room`
          });
          io.emit('global_stats', getGlobalStats());
          console.log(`[ROOM] ${playerName} joined room ${room.code}`);
        }
      } catch (err) {
        console.error('[SOCKET] join_room error:', err);
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Server error' });
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
      handleDisconnect(socket, io);
    });

    socket.on('ready_toggle', () => {
      const result = getPlayerBySocket(socket.id);
      if (!result) return;
      const { player, room } = result;
      player.ready = !player.ready;
      io.to(room.code).emit(SOCKET_EVENTS.ROOM_UPDATE, {
        room: getRoomPublicState(room)
      });
    });

    // ─────────────────────────────────────────────
    // AUCTION START
    // ─────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.START_AUCTION, ({ settings }) => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) return;
        const { player, room } = result;
        if (!player.isHost) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Only host can start auction' });
          return;
        }
        if (room.state !== GAME_STATES.LOBBY) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Auction already running' });
          return;
        }
        if (room.players.length < 1) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Need at least 1 player' });
          return;
        }
        
        // Apply any updated settings
        if (settings) {
          Object.assign(room.settings, settings);
        }
        
        // Add bots if enabled
        if (room.settings.botsEnabled) {
          const totalHumans = room.players.length;
          const targetTotal = Math.min(room.settings.botCount + totalHumans, room.settings.maxPlayers);
          if (totalHumans < targetTotal) {
            room.bots = fillWithBots(room.players, targetTotal, 10000);
          }
        }
        
        startNewRound(io, room);
      } catch (err) {
        console.error('[SOCKET] start_auction error:', err);
      }
    });

    // ─────────────────────────────────────────────
    // BIDDING
    // ─────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.PLACE_BID, ({ amount }) => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) return;
        const { player, room } = result;
        
        if (room.state !== GAME_STATES.BIDDING) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'No active auction' });
          return;
        }
        
        // Anti-spam check
        const now = Date.now();
        if (now - player.lastBidTime < ANTI_SPAM_DELAY) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Bidding too fast!' });
          return;
        }
        
        const parsedAmount = Math.floor(Number(amount));
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Invalid bid amount' });
          return;
        }
        
        if (parsedAmount > player.balance) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Insufficient balance' });
          return;
        }
        
        const auctionType = room.settings.auctionType;
        const auction = room.currentAuction;
        
        if (auctionType === AUCTION_TYPES.ENGLISH) {
          if (parsedAmount < auction.currentPrice + MIN_BID_INCREMENT) {
            socket.emit(SOCKET_EVENTS.BID_ERROR, {
              message: `Minimum bid: $${auction.currentPrice + MIN_BID_INCREMENT}`
            });
            return;
          }
          processBid(io, room, player, parsedAmount, false);
        } else if (auctionType === AUCTION_TYPES.FIRST_PRICE_SEALED || auctionType === AUCTION_TYPES.SECOND_PRICE_SEALED) {
          // Check if already submitted
          const existing = auction.bids.find(b => b.playerId === player.id);
          if (existing) {
            socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Already submitted bid' });
            return;
          }
          processBid(io, room, player, parsedAmount, true);
        }
        
        player.lastBidTime = now;
      } catch (err) {
        console.error('[SOCKET] place_bid error:', err);
      }
    });

    socket.on(SOCKET_EVENTS.BUY_NOW, () => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) return;
        const { player, room } = result;
        
        if (room.state !== GAME_STATES.BIDDING) return;
        if (room.settings.auctionType !== AUCTION_TYPES.DUTCH) return;
        
        const auction = room.currentAuction;
        const currentPrice = auction.currentPrice;
        
        if (player.balance < currentPrice) {
          socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Insufficient balance' });
          return;
        }
        
        // Dutch auction: first buyer wins immediately
        clearDutchTimer(room.code);
        processBid(io, room, player, currentPrice, false);
        endAuction(io, room);
      } catch (err) {
        console.error('[SOCKET] buy_now error:', err);
      }
    });

    socket.on(SOCKET_EVENTS.FOLD, () => {
      const result = getPlayerBySocket(socket.id);
      if (!result) return;
      const { player, room } = result;
      if (room.state !== GAME_STATES.BIDDING) return;
      if (room.settings.auctionType !== AUCTION_TYPES.ENGLISH) return;
      
      player.folded = true;
      io.to(room.code).emit(SOCKET_EVENTS.BID_UPDATE, {
        type: 'fold',
        playerName: player.name,
        playerId: player.id,
        room: getRoomPublicState(room)
      });
    });

    socket.on(SOCKET_EVENTS.AUTO_BID, ({ maxAmount }) => {
      const result = getPlayerBySocket(socket.id);
      if (!result) return;
      const { player, room } = result;
      
      const amount = Math.floor(Number(maxAmount));
      if (isNaN(amount) || amount <= 0) return;
      if (amount > player.balance) {
        socket.emit(SOCKET_EVENTS.BID_ERROR, { message: 'Auto-bid exceeds balance' });
        return;
      }
      
      player.autoBidMax = amount;
      socket.emit(SOCKET_EVENTS.NOTIFICATION, {
        type: 'info',
        message: `Auto-bid set up to $${amount.toLocaleString()}`
      });
    });

    // ─────────────────────────────────────────────
    // HOST CONTROLS
    // ─────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.KICK_PLAYER, ({ playerId }) => {
      const result = getPlayerBySocket(socket.id);
      if (!result || !result.player.isHost) return;
      const { room } = result;
      
      const idx = room.players.findIndex(p => p.id === playerId);
      if (idx === -1) return;
      
      const kicked = room.players[idx];
      if (kicked.isHost) return; // Can't kick host
      
      room.players.splice(idx, 1);
      
      io.to(kicked.socketId).emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'You were kicked' });
      io.to(kicked.socketId).emit('kicked');
      
      io.to(room.code).emit(SOCKET_EVENTS.SYSTEM_MESSAGE, {
        message: `${kicked.name} was removed by host`,
        type: 'warning'
      });
      io.to(room.code).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: getRoomPublicState(room) });
    });

    socket.on(SOCKET_EVENTS.INJECT_NEWS, ({ headline, valueImpact }) => {
      const result = getPlayerBySocket(socket.id);
      if (!result || !result.player.isHost) return;
      const { room } = result;
      
      // Adjust valuations based on news
      const factor = 1 + (valueImpact / 100);
      for (const p of room.players) p.privateValuation = Math.round(p.privateValuation * factor);
      for (const b of room.bots) b.privateValuation = Math.round(b.privateValuation * factor);
      
      io.to(room.code).emit(SOCKET_EVENTS.SYSTEM_MESSAGE, {
        message: `📰 MARKET NEWS: ${headline}`,
        type: 'news',
        valueImpact
      });
    });

    socket.on(SOCKET_EVENTS.PAUSE_TIMER, () => {
      const result = getPlayerBySocket(socket.id);
      if (!result || !result.player.isHost) return;
      const { room } = result;
      
      if (room.paused) {
        room.paused = false;
        io.to(room.code).emit(SOCKET_EVENTS.SYSTEM_MESSAGE, { message: '▶ Auction resumed', type: 'info' });
      } else {
        room.paused = true;
        io.to(room.code).emit(SOCKET_EVENTS.SYSTEM_MESSAGE, { message: '⏸ Auction paused by host', type: 'warning' });
      }
    });

    // ─────────────────────────────────────────────
    // CHAT
    // ─────────────────────────────────────────────

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, ({ message }) => {
      const result = getPlayerBySocket(socket.id);
      if (!result) return;
      const { player, room } = result;
      
      const sanitized = String(message).replace(/[<>&]/g, '').trim().substring(0, 200);
      if (!sanitized) return;
      
      const chatMsg = {
        id: Date.now(),
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar,
        message: sanitized,
        timestamp: Date.now()
      };
      
      room.chatHistory.push(chatMsg);
      if (room.chatHistory.length > 100) room.chatHistory.shift();
      
      io.to(room.code).emit(SOCKET_EVENTS.CHAT_MESSAGE, chatMsg);
    });

    // ─────────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
      handleDisconnect(socket, io);
    });

    // Send global stats on connect
    socket.emit('global_stats', getGlobalStats());
  });
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function handleDisconnect(socket, io) {
  const result = removePlayer(socket.id);
  if (!result) return;
  const { room, player, roomCode } = result;
  
  if (room) {
    io.to(roomCode).emit(SOCKET_EVENTS.SYSTEM_MESSAGE, {
      message: `${player.name} disconnected`,
      type: 'warning'
    });
    io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: getRoomPublicState(room) });
  }
  io.emit('global_stats', getGlobalStats());
}

function startNewRound(io, room) {
  room.currentRound++;
  room.state = GAME_STATES.BIDDING;
  
  // Assign new valuations
  const commonValue = assignValuations(room);
  const { theme, auctionType, startPrice, timerDuration } = room.settings;
  const themeConfig = THEME_CONFIG[theme];
  
  // Initialize auction state
  room.currentAuction = {
    id: `${room.code}_${room.currentRound}`,
    round: room.currentRound,
    auctionType,
    theme,
    themeConfig: { name: themeConfig.name, emoji: themeConfig.emoji, description: themeConfig.description },
    startPrice: auctionType === AUCTION_TYPES.DUTCH
      ? Math.round(startPrice * room.settings.dutchStartMultiplier)
      : startPrice,
    currentPrice: auctionType === AUCTION_TYPES.DUTCH
      ? Math.round(startPrice * room.settings.dutchStartMultiplier)
      : startPrice,
    bids: [],
    bidFeed: [],
    timeLeft: timerDuration,
    started: Date.now(),
    commonValue, // hidden from players
    paused: false
  };
  
  // Notify all players
  io.to(room.code).emit(SOCKET_EVENTS.AUCTION_STARTED, {
    room: getRoomPublicState(room),
    round: room.currentRound,
    auctionType,
    theme,
    privateValuations: buildValuationMap(room) // Each player gets their own
  });
  
  // Send private valuations individually
  for (const player of room.players) {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit('your_valuation', {
        privateValuation: player.privateValuation,
        commonEstimate: player.commonValueEstimate,
        riskProfile: player.riskProfile
      });
    }
  }
  
  // Start timer
  startAuctionTimer(io, room);
  
  // Start bot behavior
  if (room.bots.length > 0) {
    scheduleBotBids(io, room);
  }
  
  console.log(`[AUCTION] Room ${room.code} Round ${room.currentRound} started - ${auctionType}`);
}

function buildValuationMap(room) {
  const map = {};
  for (const p of room.players) map[p.id] = p.privateValuation;
  return map;
}

function processBid(io, room, player, amount, isSealed) {
  const auction = room.currentAuction;
  
  const bid = {
    playerId: player.id,
    playerName: player.name,
    amount,
    valuation: player.privateValuation,
    timestamp: Date.now(),
    isBot: false,
    folded: false
  };
  
  if (isSealed) {
    // Sealed bid: just record, don't show amount
    auction.bids.push(bid);
    player.bidsPlaced++;
    
    io.to(room.code).emit(SOCKET_EVENTS.BID_UPDATE, {
      type: 'sealed_bid_placed',
      playerName: player.name,
      playerId: player.id,
      bidsSubmitted: auction.bids.length,
      room: getRoomPublicState(room)
    });
  } else {
    // Open bid
    auction.currentPrice = amount;
    player.currentBid = amount;
    auction.bids.push(bid);
    player.bidsPlaced++;
    
    // Add to feed
    const feedItem = {
      id: Date.now(),
      playerName: player.name,
      amount,
      timestamp: Date.now()
    };
    auction.bidFeed.unshift(feedItem);
    if (auction.bidFeed.length > 20) auction.bidFeed.pop();
    
    io.to(room.code).emit(SOCKET_EVENTS.BID_UPDATE, {
      type: 'new_bid',
      playerName: player.name,
      playerId: player.id,
      amount,
      currentPrice: auction.currentPrice,
      feed: feedItem,
      room: getRoomPublicState(room)
    });
    
    // Check auto-bids
    processAutoBids(io, room, player.id, amount);
  }
}

function processAutoBids(io, room, lastBidderId, lastAmount) {
  for (const p of room.players) {
    if (p.id === lastBidderId || p.folded || !p.autoBidMax) continue;
    if (p.autoBidMax > lastAmount + MIN_BID_INCREMENT && p.balance >= lastAmount + MIN_BID_INCREMENT) {
      const autoBid = lastAmount + MIN_BID_INCREMENT;
      setTimeout(() => {
        if (room.state === GAME_STATES.BIDDING) {
          processBid(io, room, p, autoBid, false);
        }
      }, 300 + Math.random() * 500);
    }
  }
}

function startAuctionTimer(io, room) {
  clearRoomTimers(room.code);
  
  const auction = room.currentAuction;
  const auctionType = room.settings.auctionType;
  
  if (auctionType === AUCTION_TYPES.DUTCH) {
    // Dutch: price decreases every interval
    const dutchTimer = setInterval(() => {
      if (room.paused) return;
      if (room.state !== GAME_STATES.BIDDING) {
        clearInterval(dutchTimer);
        return;
      }
      
      auction.currentPrice = Math.max(0, auction.currentPrice - room.settings.dutchDecrement);
      auction.timeLeft = Math.max(0, auction.timeLeft - (room.settings.dutchInterval / 1000));
      
      io.to(room.code).emit(SOCKET_EVENTS.TIMER_UPDATE, {
        timeLeft: auction.timeLeft,
        currentPrice: auction.currentPrice
      });
      
      if (auction.currentPrice <= 0 || auction.timeLeft <= 0) {
        clearInterval(dutchTimer);
        endAuction(io, room);
      }
    }, room.settings.dutchInterval);
    
    roomTimers.set(room.code + '_dutch', dutchTimer);
  } else {
    // English / Sealed: countdown timer
    const countdownTimer = setInterval(() => {
      if (room.paused) return;
      if (room.state !== GAME_STATES.BIDDING) {
        clearInterval(countdownTimer);
        return;
      }
      
      auction.timeLeft--;
      
      io.to(room.code).emit(SOCKET_EVENTS.TIMER_UPDATE, {
        timeLeft: auction.timeLeft,
        currentPrice: auction.currentPrice
      });
      
      if (auction.timeLeft <= 0) {
        clearInterval(countdownTimer);
        endAuction(io, room);
      }
    }, 1000);
    
    roomTimers.set(room.code + '_countdown', countdownTimer);
  }
}

function clearDutchTimer(roomCode) {
  const timer = roomTimers.get(roomCode + '_dutch');
  if (timer) { clearInterval(timer); roomTimers.delete(roomCode + '_dutch'); }
}

function clearRoomTimers(roomCode) {
  ['_dutch', '_countdown', '_bot'].forEach(suffix => {
    const key = roomCode + suffix;
    const t = roomTimers.get(key);
    if (t) { clearInterval(t); clearTimeout(t); roomTimers.delete(key); }
  });
  
  const botInt = botIntervals.get(roomCode);
  if (botInt) { clearInterval(botInt); botIntervals.delete(roomCode); }
}

function scheduleBotBids(io, room) {
  const auctionType = room.settings.auctionType;
  
  if (auctionType === AUCTION_TYPES.FIRST_PRICE_SEALED || auctionType === AUCTION_TYPES.SECOND_PRICE_SEALED) {
    // Bots submit sealed bids after random delay
    for (const bot of room.bots) {
      const delay = 2000 + Math.random() * (room.settings.timerDuration * 0.7 * 1000);
      setTimeout(() => {
        if (room.state !== GAME_STATES.BIDDING) return;
        const bidAmount = generateSealedBid(bot, bot.privateValuation, 
          room.players.length + room.bots.length, auctionType);
        if (bidAmount > 0 && bidAmount <= bot.balance) {
          const bid = {
            playerId: bot.id,
            playerName: bot.name,
            amount: bidAmount,
            valuation: bot.privateValuation,
            timestamp: Date.now(),
            isBot: true,
            folded: false
          };
          room.currentAuction.bids.push(bid);
          bot.bidsPlaced++;
          
          io.to(room.code).emit(SOCKET_EVENTS.BID_UPDATE, {
            type: 'sealed_bid_placed',
            playerName: bot.name,
            playerId: bot.id,
            bidsSubmitted: room.currentAuction.bids.length,
            room: getRoomPublicState(room)
          });
        }
      }, delay);
    }
    return;
  }
  
  if (auctionType === AUCTION_TYPES.DUTCH) {
    // Bots check periodically if they should buy
    const interval = setInterval(() => {
      if (room.state !== GAME_STATES.BIDDING) { clearInterval(interval); return; }
      
      for (const bot of room.bots) {
        if (bot.folded) continue;
        const should = shouldBotBuyDutch(bot, room.currentAuction.currentPrice, bot.privateValuation);
        if (should && bot.balance >= room.currentAuction.currentPrice) {
          clearInterval(interval);
          botIntervals.delete(room.code);
          
          const bid = {
            playerId: bot.id, playerName: bot.name,
            amount: room.currentAuction.currentPrice,
            valuation: bot.privateValuation,
            timestamp: Date.now(), isBot: true, folded: false
          };
          room.currentAuction.bids.push(bid);
          room.currentAuction.currentPrice = bid.amount;
          bot.bidsPlaced++;
          
          clearDutchTimer(room.code);
          
          io.to(room.code).emit(SOCKET_EVENTS.BID_UPDATE, {
            type: 'new_bid',
            playerName: bot.name,
            playerId: bot.id,
            amount: bid.amount,
            currentPrice: bid.amount,
            room: getRoomPublicState(room)
          });
          
          endAuction(io, room);
          return;
        }
      }
    }, 800 + Math.random() * 400);
    botIntervals.set(room.code, interval);
    return;
  }
  
  if (auctionType === AUCTION_TYPES.ENGLISH) {
    // Schedule individual bot bids at random intervals
    for (const bot of room.bots) {
      scheduleNextBotBid(io, room, bot);
    }
  }
}

function scheduleNextBotBid(io, room, bot) {
  const [minDelay, maxDelay] = bot.decisionDelay;
  const delay = minDelay + Math.random() * (maxDelay - minDelay);
  
  setTimeout(() => {
    if (room.state !== GAME_STATES.BIDDING || bot.folded) return;
    
    const auctionState = {
      currentPrice: room.currentAuction.currentPrice,
      auctionType: room.settings.auctionType,
      timeLeft: room.currentAuction.timeLeft,
      numBidders: room.players.filter(p => !p.folded).length + room.bots.filter(b => !b.folded).length,
      startPrice: room.currentAuction.startPrice
    };
    
    const bidAmount = calculateBotBid(bot, auctionState, bot.privateValuation);
    
    if (bidAmount > 0 && bidAmount <= bot.balance && bidAmount >= room.currentAuction.currentPrice + MIN_BID_INCREMENT) {
      const bid = {
        playerId: bot.id, playerName: bot.name,
        amount: bidAmount, valuation: bot.privateValuation,
        timestamp: Date.now(), isBot: true, folded: false
      };
      
      room.currentAuction.currentPrice = bidAmount;
      bot.currentBid = bidAmount;
      room.currentAuction.bids.push(bid);
      bot.bidsPlaced++;
      
      const feedItem = { id: Date.now(), playerName: bot.name, amount: bidAmount, timestamp: Date.now() };
      room.currentAuction.bidFeed.unshift(feedItem);
      if (room.currentAuction.bidFeed.length > 20) room.currentAuction.bidFeed.pop();
      
      io.to(room.code).emit(SOCKET_EVENTS.BID_UPDATE, {
        type: 'new_bid',
        playerName: bot.name,
        playerId: bot.id,
        amount: bidAmount,
        currentPrice: bidAmount,
        feed: feedItem,
        isBot: true,
        room: getRoomPublicState(room)
      });
      
      processAutoBids(io, room, bot.id, bidAmount);
    }
    
    // Schedule next bid attempt
    if (room.state === GAME_STATES.BIDDING && !bot.folded) {
      scheduleNextBotBid(io, room, bot);
    }
  }, delay);
}

function endAuction(io, room) {
  if (room.state === GAME_STATES.RESULTS || room.state === GAME_STATES.LOBBY) return;
  
  clearRoomTimers(room.code);
  room.state = GAME_STATES.REVEAL;
  
  const auction = room.currentAuction;
  const allBids = auction.bids;
  
  // Determine result
  const result = determineAuctionResult(
    room.settings.auctionType, allBids, auction.commonValue
  );
  
  // Collect all valuations for analytics
  const allValuations = [
    ...room.players.map(p => p.privateValuation),
    ...room.bots.map(b => b.privateValuation)
  ];
  
  const efficiency = result
    ? calculateEfficiency(result.allBids[0]?.valuation || result.winningBid, allValuations)
    : 0;
    
  const expectedRevenue = calculateExpectedRevenue(allValuations, room.settings.auctionType);
  const bidStats = analyzeBidDistribution(allBids);
  
  // Calculate Nash approximation
  const nashBids = allValuations.map(v => nashEquilibriumBid(v, allValuations.length));
  const nashRevenue = Math.max(...nashBids);
  
  // Build full analytics
  const roundAnalytics = {
    result,
    trueCommonValue: auction.commonValue,
    allBids: allBids.map(b => ({
      ...b,
      surplus: calculateBidderSurplus(b.valuation || b.amount, result?.pricePaid || b.amount)
    })),
    allValuations,
    efficiency: Math.round(efficiency),
    expectedRevenue,
    actualRevenue: result?.revenue || 0,
    nashRevenue,
    bidStats,
    winnersCurse: result?.winnersCurse,
    auctionType: room.settings.auctionType,
    theme: room.settings.theme,
    round: room.currentRound
  };
  
  room.auctionHistory.push(roundAnalytics);
  
  // Update room analytics
  if (result) {
    room.analytics.totalRevenue += result.revenue;
    room.analytics.totalRounds++;
    if (result.winnersCurse?.isWinnersCurse) room.analytics.winnersCurseCount++;
    
    // Update winner balance and stats
    const winner = room.players.find(p => p.id === result.winner) ||
                   room.bots.find(b => b.id === result.winner);
    if (winner) {
      winner.balance -= result.pricePaid;
      winner.wins++;
      const surplus = (winner.privateValuation || result.winningBid) - result.pricePaid;
      winner.totalProfit += surplus;
      winner.score += Math.max(0, surplus) + 100; // 100 pts for winning
    }
    
    // Deduct from loser balances if English/Dutch (they didn't pay)
    // Only winner pays, but track overall scores
    for (const p of room.players) {
      if (p.id !== result.winner) {
        p.score += Math.max(0, 10 - room.currentRound); // Participation points
      }
    }
  }
  
  room.state = GAME_STATES.RESULTS;
  
  io.to(room.code).emit(SOCKET_EVENTS.AUCTION_ENDED, {
    analytics: roundAnalytics,
    room: getRoomPublicState(room, true),
    isLastRound: room.currentRound >= room.settings.numRounds
  });
  
  if (result) {
    io.to(room.code).emit(SOCKET_EVENTS.WINNER_ANNOUNCED, {
      winnerId: result.winner,
      winnerName: result.winnerName,
      amount: result.pricePaid,
      surplus: result.winnersCurse ? result.winnersCurse.profit : 0
    });
  }
  
  console.log(`[AUCTION] Room ${room.code} Round ${room.currentRound} ended. Winner: ${result?.winnerName || 'none'}`);
  
  // Auto-advance if more rounds
  if (room.currentRound < room.settings.numRounds) {
    setTimeout(() => {
      if (room.state === GAME_STATES.RESULTS) {
        startNewRound(io, room);
      }
    }, 8000);
  } else {
    room.state = GAME_STATES.ENDED;
    io.to(room.code).emit('game_ended', {
      room: getRoomPublicState(room, true),
      history: room.auctionHistory,
      finalAnalytics: room.analytics
    });
    
    // Return to lobby after delay
    setTimeout(() => {
      room.state = GAME_STATES.LOBBY;
      room.currentRound = 0;
      room.bots = [];
      room.currentAuction = null;
      for (const p of room.players) {
        p.balance = 10000; p.score = 0; p.wins = 0; p.ready = false;
        p.totalProfit = 0; p.bidsPlaced = 0;
      }
      io.to(room.code).emit(SOCKET_EVENTS.ROOM_UPDATE, { room: getRoomPublicState(room) });
    }, 15000);
  }
}

module.exports = { initializeSocketHandlers };
