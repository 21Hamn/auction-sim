// client/public/js/socket.js
// Socket.IO client event handling

function initSocket() {
  AppState.socket = io({ transports: ['websocket', 'polling'] });
  const socket = AppState.socket;

  // ── CONNECTION ──────────────────────────────────

  socket.on('connect', () => {
    AppState.connected = true;
    console.log('[SOCKET] Connected:', socket.id);
  });

  socket.on('disconnect', () => {
    AppState.connected = false;
    showToast('Connection lost. Reconnecting...', 'warning');
  });

  socket.on('reconnect', () => {
    AppState.connected = true;
    showToast('Reconnected!', 'success');
  });

  // ── GLOBAL STATS ────────────────────────────────

  socket.on('global_stats', (stats) => {
    updateGlobalStats(stats);
  });

  // ── ROOM EVENTS ─────────────────────────────────

  socket.on(SOCKET_EVENTS.ROOM_JOINED, ({ room, playerId, isHost }) => {
    AppState.myId = playerId;
    AppState.isHost = isHost;
    AppState.room = room;
    AppState.roomCode = room.code;
    showPage('lobby');
    renderLobby(room, isHost);
    showToast(`Joined room ${room.code}!`, 'success');
  });

  socket.on(SOCKET_EVENTS.ROOM_ERROR, ({ message }) => {
    showToast(message, 'error');
  });

  socket.on(SOCKET_EVENTS.ROOM_UPDATE, ({ room, notification }) => {
    AppState.room = room;
    if (AppState.currentPage === 'lobby') {
      renderLobby(room, AppState.isHost);
    } else if (AppState.currentPage === 'auction') {
      renderLeaderboard(room.players);
    }
    if (notification) showToast(notification, 'info');
  });

  socket.on('kicked', () => {
    showPage('landing');
    AppState.room = null;
    AppState.myId = null;
    showToast('You were removed from the room.', 'error');
  });

  // ── AUCTION EVENTS ──────────────────────────────

  socket.on(SOCKET_EVENTS.AUCTION_STARTED, ({ room, round, auctionType, theme }) => {
    AppState.room = room;
    AppState.hasSubmittedSealedBid = false;
    AppState.autoBidMax = 0;
    if (room.currentAuction) {
      AppState.currentAuction = room.currentAuction;
      AppState.timerOriginalDuration = room.currentAuction.timeLeft;
    }
    showPage('auction');
    initAuctionUI(room, round, auctionType, theme);
    showToast(`Round ${round} started — ${AUCTION_TYPE_LABELS[auctionType] || auctionType}`, 'info');
  });

  socket.on('your_valuation', ({ privateValuation, commonEstimate, riskProfile }) => {
    AppState.privateValuation = privateValuation;
    AppState.commonEstimate = commonEstimate;
    AppState.riskProfile = riskProfile;
    updateValuationDisplay(privateValuation, commonEstimate);
    updateEducationalPanel(AppState.room?.settings?.auctionType, privateValuation);
  });

  socket.on(SOCKET_EVENTS.BID_UPDATE, (data) => {
    handleBidUpdate(data);
  });

  socket.on(SOCKET_EVENTS.TIMER_UPDATE, ({ timeLeft, currentPrice }) => {
    updateTimer(timeLeft, AppState.timerOriginalDuration);
    if (currentPrice !== undefined) {
      updatePriceDisplay(currentPrice);
      AppState.currentAuction && (AppState.currentAuction.currentPrice = currentPrice);
    }
  });

  socket.on(SOCKET_EVENTS.BID_ERROR, ({ message }) => {
    showToast(message, 'error');
  });

  socket.on(SOCKET_EVENTS.WINNER_ANNOUNCED, ({ winnerId, winnerName, amount, surplus }) => {
    showWinnerOverlay(winnerName, amount, surplus, winnerId === AppState.myId);
    triggerHammerAnimation();
  });

  socket.on(SOCKET_EVENTS.AUCTION_ENDED, ({ analytics, room, isLastRound }) => {
    AppState.room = room;
    AppState.lastAnalytics = analytics;
    clearClientTimer();
    showPage('results');
    renderResults(analytics, isLastRound);
  });

  socket.on('game_ended', ({ room, history, finalAnalytics }) => {
    AppState.room = room;
    // Results page already shown — just update subtitle
    const subtitle = document.getElementById('result-next-info');
    if (subtitle) subtitle.textContent = 'Game Over! Returning to lobby in 15s...';
  });

  // ── CHAT ────────────────────────────────────────

  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (msg) => {
    appendChatMessage(msg, false);
  });

  socket.on(SOCKET_EVENTS.SYSTEM_MESSAGE, ({ message, type }) => {
    appendSystemMessage(message, type);
  });

  // ── NOTIFICATIONS ────────────────────────────────

  socket.on(SOCKET_EVENTS.NOTIFICATION, ({ type, message }) => {
    showToast(message, type);
  });

  return socket;
}

// ── EMIT HELPERS ─────────────────────────────────

function emitJoinRoom(roomCode, playerName, createNew, settings) {
  AppState.socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, playerName, createNew, settings });
}

function emitPlaceBid(amount) {
  AppState.socket.emit(SOCKET_EVENTS.PLACE_BID, { amount });
}

function emitBuyNow() {
  AppState.socket.emit(SOCKET_EVENTS.BUY_NOW);
}

function emitFold() {
  AppState.socket.emit(SOCKET_EVENTS.FOLD);
}

function emitAutoBid(maxAmount) {
  AppState.socket.emit(SOCKET_EVENTS.AUTO_BID, { maxAmount });
}

function emitStartAuction(settings) {
  AppState.socket.emit(SOCKET_EVENTS.START_AUCTION, { settings });
}

function emitReadyToggle() {
  AppState.socket.emit('ready_toggle');
}

function emitChatMessage(message) {
  AppState.socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { message });
}

function emitKickPlayer(playerId) {
  AppState.socket.emit(SOCKET_EVENTS.KICK_PLAYER, { playerId });
}

function emitPauseTimer() {
  AppState.socket.emit(SOCKET_EVENTS.PAUSE_TIMER);
}

function emitInjectNews(headline, valueImpact) {
  AppState.socket.emit(SOCKET_EVENTS.INJECT_NEWS, { headline, valueImpact: Number(valueImpact) });
}

function emitLeaveRoom() {
  AppState.socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
}
