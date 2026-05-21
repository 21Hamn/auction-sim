// client/public/js/ui.js
// UI rendering, toast, pages, modals

// ── PAGE NAVIGATION ──────────────────────────────

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  const page = document.getElementById(`page-${name}`);
  if (page) {
    page.classList.remove('hidden');
    page.classList.add('active');
  }
  AppState.currentPage = name;
}

// ── TOAST NOTIFICATIONS ──────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── MODAL CONTROLS ───────────────────────────────

function showCreateModal() {
  document.getElementById('modal-create').classList.remove('hidden');
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('create-name').focus();
}

function showJoinModal() {
  document.getElementById('modal-join').classList.remove('hidden');
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('join-name').focus();
}

function showNewsModal() {
  document.getElementById('modal-news').classList.remove('hidden');
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('modal-backdrop').classList.add('hidden');
}

// ── GLOBAL STATS (LANDING) ───────────────────────

function updateGlobalStats(stats) {
  setText('nav-rooms', stats.activeRooms);
  setText('nav-players', stats.totalPlayers);
  setText('gs-rooms', stats.activeRooms);
  setText('gs-players', stats.totalPlayers);
  setText('gs-auctions', stats.activeAuctions);
  setText('gs-bids', stats.totalBids);
  updateLiveMonitor(stats);
}

function updateLiveMonitor(stats) {
  const monitor = document.getElementById('live-monitor');
  if (!monitor) return;
  if (stats.activeRooms === 0) {
    monitor.innerHTML = '<span class="ticker-item">No active auctions — Create one to start!</span>';
    return;
  }
  monitor.innerHTML = `
    <span class="ticker-item">${stats.activeRooms} rooms active</span>
    <span class="ticker-item">${stats.totalPlayers} players online</span>
    <span class="ticker-item">${stats.activeAuctions} live auctions</span>
    <span class="ticker-item">${stats.totalBids} bids today</span>
  `;
}

// ── LOBBY RENDERING ──────────────────────────────

function renderLobby(room, isHost) {
  const code = document.getElementById('lobby-room-code');
  if (code) code.textContent = room.code;

  renderPlayersList(room.players, isHost);
  updatePlayerCountBadge(room.players.length, room.settings.maxPlayers);

  const settingsPanel = document.getElementById('settings-panel');
  const hostControls = document.getElementById('host-controls');

  if (settingsPanel) {
    settingsPanel.classList.toggle('hidden', !isHost || room.state !== GAME_STATES.LOBBY);
  }
  if (hostControls) {
    hostControls.classList.toggle('hidden', !isHost || room.state === GAME_STATES.LOBBY);
  }

  // Update kick player dropdown
  if (isHost) {
    const kickSelect = document.getElementById('kick-select');
    if (kickSelect) {
      kickSelect.innerHTML = room.players
        .filter(p => !p.isHost)
        .map(p => `<option value="${p.id}">${p.avatar} ${p.name}</option>`)
        .join('');
    }
  }
}

function renderPlayersList(players, isHost) {
  const list = document.getElementById('players-list');
  if (!list) return;
  list.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';
    const badges = [];
    if (p.isHost) badges.push('<span class="player-badge badge-host">HOST</span>');
    if (p.isBot) badges.push('<span class="player-badge badge-bot">BOT</span>');
    if (p.ready && !p.isHost) badges.push('<span class="player-badge badge-ready">READY</span>');
    const isMe = p.id === AppState.myId;
    card.innerHTML = `
      <div class="player-avatar">${p.avatar}</div>
      <div class="player-info">
        <div class="player-name">${p.name}${isMe ? ' <span style="color:var(--muted);font-size:0.7rem">(you)</span>' : ''}</div>
        <div class="player-sub">💰 $${p.balance.toLocaleString()} · 🏆 ${p.wins} wins</div>
      </div>
      ${badges.join('')}
    `;
    if (!p.connected) card.style.opacity = '0.4';
    list.appendChild(card);
  });
}

function updatePlayerCountBadge(count, max) {
  const badge = document.getElementById('player-count-badge');
  if (badge) badge.textContent = `${count}/${max}`;
}

// ── AUCTION UI ───────────────────────────────────

function initAuctionUI(room, round, auctionType, theme) {
  const auction = room.currentAuction;
  if (!auction) return;

  // Type badge
  setText('auction-type-badge', AUCTION_TYPE_LABELS[auctionType] || auctionType);
  setText('auction-theme-badge', auction.themeConfig ? `${auction.themeConfig.emoji} ${auction.themeConfig.name}` : theme);
  setText('auction-round', round);
  setText('auction-total-rounds', room.settings.numRounds);

  // Price label
  setText('price-label', PRICE_LABELS[auctionType] || 'CURRENT BID');

  // Item showcase
  if (auction.themeConfig) {
    setText('item-emoji', auction.themeConfig.emoji);
    setText('item-name', auction.themeConfig.name);
    setText('item-desc', auction.themeConfig.description);
  }

  // Price
  if (auctionType === AUCTION_TYPES.FIRST_PRICE_SEALED || auctionType === AUCTION_TYPES.SECOND_PRICE_SEALED) {
    setText('current-price', '0 bids');
  } else {
    updatePriceDisplay(auction.currentPrice || auction.startPrice);
  }

  // Timer
  AppState.timerOriginalDuration = auction.timeLeft || room.settings.timerDuration;
  updateTimer(auction.timeLeft || room.settings.timerDuration, AppState.timerOriginalDuration);

  // My info
  const me = room.players.find(p => p.id === AppState.myId);
  if (me) {
    setText('my-balance', `$${me.balance.toLocaleString()}`);
  }

  // Show correct controls
  showBidControls(auctionType);

  // Reset bid feed
  const feed = document.getElementById('bid-feed');
  if (feed) feed.innerHTML = '';

  // Reset sealed bid state
  AppState.hasSubmittedSealedBid = false;
  const sealedSubmitted = document.getElementById('sealed-submitted');
  const sealedInput = document.getElementById('btn-submit-sealed');
  if (sealedSubmitted) sealedSubmitted.classList.add('hidden');
  if (sealedInput) sealedInput.disabled = false;

  // Leaderboard
  renderLeaderboard(room.players);

  // Bid count display for sealed
  if (auctionType === AUCTION_TYPES.FIRST_PRICE_SEALED || auctionType === AUCTION_TYPES.SECOND_PRICE_SEALED) {
    setText('price-label', 'BIDS IN');
    setText('current-price', '0');
  }

  // Dutch special UI
  if (auctionType === AUCTION_TYPES.DUTCH) {
    setText('buy-now-price', `$${(auction.currentPrice || auction.startPrice).toLocaleString()}`);
  }

  // Show host controls bar if host
  showAuctionHostBar(room);
}

function showBidControls(auctionType) {
  ['controls-english', 'controls-dutch', 'controls-sealed'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  if (auctionType === AUCTION_TYPES.ENGLISH) {
    document.getElementById('controls-english')?.classList.remove('hidden');
  } else if (auctionType === AUCTION_TYPES.DUTCH) {
    document.getElementById('controls-dutch')?.classList.remove('hidden');
  } else {
    document.getElementById('controls-sealed')?.classList.remove('hidden');
    // Set hint for sealed bid type
    const hint = document.getElementById('sealed-strategy-hint');
    if (hint) {
      if (auctionType === AUCTION_TYPES.SECOND_PRICE_SEALED) {
        hint.textContent = '💡 Vickrey: Bid your TRUE valuation — it\'s the dominant strategy!';
        hint.style.color = 'var(--green)';
      } else {
        hint.textContent = '💡 First-Price: Nash equilibrium bid = (N-1)/N × your valuation';
        hint.style.color = 'var(--yellow)';
      }
    }
  }
}

function updatePriceDisplay(price) {
  const el = document.getElementById('current-price');
  if (!el) return;
  const formatted = typeof price === 'number' ? `$${price.toLocaleString()}` : price;
  if (el.textContent !== formatted) {
    el.textContent = formatted;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 400);
  }
  // Update buy now button too
  const buyNowPrice = document.getElementById('buy-now-price');
  if (buyNowPrice && typeof price === 'number') {
    buyNowPrice.textContent = `$${price.toLocaleString()}`;
  }
}

function updateValuationDisplay(valuation, commonEstimate) {
  const el = document.getElementById('my-valuation');
  if (el) el.textContent = `$${valuation.toLocaleString()}`;

  // Pre-fill suggested bids for English
  const englishInput = document.getElementById('bid-amount-english');
  if (englishInput && !englishInput.value) {
    const auction = AppState.currentAuction;
    const suggested = auction ? auction.currentPrice + 100 : valuation;
    englishInput.placeholder = `Suggested: $${suggested.toLocaleString()}`;
  }
}

// ── TIMER ────────────────────────────────────────

function updateTimer(timeLeft, totalDuration) {
  const valueEl = document.getElementById('timer-value');
  const progressEl = document.getElementById('timer-progress-circle');

  if (valueEl) valueEl.textContent = Math.max(0, Math.ceil(timeLeft));

  if (progressEl && totalDuration > 0) {
    const ratio = Math.max(0, timeLeft / totalDuration);
    const circumference = 100;
    progressEl.style.strokeDashoffset = circumference * (1 - ratio);

    progressEl.classList.remove('warning', 'danger');
    if (valueEl) valueEl.style.color = 'var(--green)';

    if (timeLeft <= 5) {
      progressEl.classList.add('danger');
      if (valueEl) valueEl.style.color = 'var(--red)';
    } else if (timeLeft <= 15) {
      progressEl.classList.add('warning');
      if (valueEl) valueEl.style.color = 'var(--orange)';
    }
  }
}

function clearClientTimer() {
  if (AppState.currentTimerInterval) {
    clearInterval(AppState.currentTimerInterval);
    AppState.currentTimerInterval = null;
  }
}

// ── BID FEED ─────────────────────────────────────

function appendBidFeedItem(playerName, amount, isBot = false) {
  const feed = document.getElementById('bid-feed');
  if (!feed) return;

  const item = document.createElement('div');
  item.className = `bid-feed-item${isBot ? ' bot' : ''}`;
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  item.innerHTML = `
    <span class="feed-name${isBot ? ' bot' : ''}">${isBot ? '🤖' : '👤'} ${playerName}</span>
    <span class="feed-amount">$${amount.toLocaleString()}</span>
    <span class="feed-time">${timeStr}</span>
  `;
  feed.insertBefore(item, feed.firstChild);

  // Keep only last 12 items
  while (feed.children.length > 12) feed.removeChild(feed.lastChild);

  // Pulse effect on bid controls
  const bidControls = document.getElementById('bid-controls');
  if (bidControls) {
    bidControls.classList.add('bid-pulse');
    setTimeout(() => bidControls.classList.remove('bid-pulse'), 500);
  }
}

function handleBidUpdate(data) {
  const { type, playerName, amount, currentPrice, bidsSubmitted, isBot, room } = data;

  if (room) {
    AppState.room = room;
    if (room.currentAuction) AppState.currentAuction = room.currentAuction;
  }

  if (type === 'new_bid') {
    appendBidFeedItem(playerName, amount, isBot);
    updatePriceDisplay(currentPrice);
    renderLeaderboard(room?.players || AppState.room?.players || []);

    // Update my balance if shown
    const me = AppState.room?.players?.find(p => p.id === AppState.myId);
    if (me) setText('my-balance', `$${me.balance.toLocaleString()}`);

    if (playerName !== AppState.myName) {
      showToast(`${playerName} bid $${amount.toLocaleString()}`, 'info', 1800);
    }
  } else if (type === 'sealed_bid_placed') {
    // Show count of submitted bids
    updatePriceDisplay(bidsSubmitted);
    setText('price-label', 'BIDS IN');
    appendChatMessage({
      playerName: '🔒 System',
      message: `${playerName} submitted a sealed bid (${bidsSubmitted} total)`,
      isSystem: true
    }, true);
  } else if (type === 'fold') {
    appendChatMessage({
      playerName: '📋 System',
      message: `${playerName} folded`,
      isSystem: true
    }, true);
  }
}

// ── LEADERBOARD ──────────────────────────────────

function renderLeaderboard(players) {
  const lb = document.getElementById('leaderboard');
  if (!lb || !players) return;
  // Refresh host kick dropdown too
  if (AppState.isHost) updateAuctionKickDropdown(players);

  const sorted = [...players].sort((a, b) => b.balance - a.balance);
  lb.innerHTML = '';
  sorted.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = `lb-item${p.id === AppState.myId ? ' me' : ''}`;
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const rankStr = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    item.innerHTML = `
      <div class="lb-rank ${rankClass}">${rankStr}</div>
      <div class="lb-avatar">${p.avatar || '👤'}</div>
      <div class="lb-name">${p.name}${p.isBot ? ' 🤖' : ''}</div>
      <div class="lb-balance">$${(p.balance || 0).toLocaleString()}</div>
      <div class="lb-wins">🏆${p.wins || 0}</div>
    `;
    lb.appendChild(item);
  });
}

// ── CHAT ─────────────────────────────────────────

function appendChatMessage(msg, isAuction = false) {
  const containerId = isAuction || AppState.currentPage === 'auction' ? 'auction-chat' : 'chat-messages';
  const container = document.getElementById(containerId);
  if (!container) return;

  const div = document.createElement('div');
  if (msg.isSystem) {
    div.className = 'chat-msg system';
    div.textContent = msg.message;
  } else {
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-msg-name">${msg.avatar || ''} ${msg.playerName}:</span> <span class="chat-msg-text">${msg.message}</span>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Mirror to lobby chat if in auction
  if (isAuction && AppState.currentPage === 'lobby') {
    const lobbyChat = document.getElementById('chat-messages');
    if (lobbyChat) {
      lobbyChat.appendChild(div.cloneNode(true));
      lobbyChat.scrollTop = lobbyChat.scrollHeight;
    }
  }
}

function appendSystemMessage(message, type = 'info') {
  const containers = ['chat-messages', 'auction-chat'];
  containers.forEach(id => {
    const container = document.getElementById(id);
    if (!container) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${type === 'news' ? 'news' : 'system'}`;
    div.textContent = message;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  });

  if (type === 'news') showToast(message, 'warning', 5000);
  else showToast(message, type === 'warning' ? 'warning' : 'info', 2500);
}

// ── WINNER OVERLAY ───────────────────────────────

function showWinnerOverlay(winnerName, amount, surplus, isMe) {
  const overlay = document.getElementById('winner-overlay');
  setText('winner-name', winnerName + (isMe ? ' 🎉 (YOU!)' : ''));
  setText('winner-price', `$${amount.toLocaleString()}`);

  const surplusEl = document.getElementById('winner-surplus');
  if (surplusEl) {
    if (surplus > 0) {
      surplusEl.textContent = `Profit: +$${surplus.toLocaleString()}`;
      surplusEl.style.color = 'var(--green)';
    } else if (surplus < 0) {
      surplusEl.textContent = `Loss: -$${Math.abs(surplus).toLocaleString()} ⚠️`;
      surplusEl.style.color = 'var(--red)';
    } else {
      surplusEl.textContent = '';
    }
  }

  overlay.classList.remove('hidden');
  if (isMe) playWinSound();
  setTimeout(() => overlay.classList.add('hidden'), 4000);
}

function triggerHammerAnimation() {
  const hammer = document.getElementById('hammer-anim');
  if (hammer) {
    hammer.style.animation = 'none';
    hammer.style.fontSize = '4rem';
    setTimeout(() => {
      hammer.style.fontSize = '2rem';
      hammer.style.animation = 'hammerSwing 4s ease-in-out infinite';
    }, 800);
  }
}

// ── RESULTS PAGE ─────────────────────────────────

function renderResults(analytics, isLastRound) {
  if (!analytics) return;
  const { result, efficiency, expectedRevenue, actualRevenue, nashRevenue, winnersCurse,
    trueCommonValue, allBids, allValuations } = analytics;

  setText('result-round', analytics.round || '?');
  setText('result-next-info', isLastRound
    ? 'Game Over! Final results. Returning to lobby in 15s...'
    : 'Next round starting in 8 seconds...');

  if (result) {
    setText('result-winner-name', result.winnerName || 'No Winner');
    setText('result-price', `$${(result.pricePaid || 0).toLocaleString()}`);

    const surplus = winnersCurse ? winnersCurse.profit : 0;
    const surplusEl = document.getElementById('result-surplus');
    if (surplusEl) {
      surplusEl.className = 'winner-card-surplus ' + (surplus >= 0 ? 'positive' : 'negative');
      surplusEl.textContent = surplus >= 0
        ? `Profit: +$${surplus.toLocaleString()}`
        : `Winner's Curse: -$${Math.abs(surplus).toLocaleString()}`;
    }

    const curseAlert = document.getElementById('winners-curse-alert');
    if (curseAlert) {
      curseAlert.classList.toggle('hidden', !winnersCurse?.isWinnersCurse);
    }
  }

  setText('rs-efficiency', `${efficiency || 0}%`);
  setText('rs-expected', `$${(expectedRevenue || 0).toLocaleString()}`);
  setText('rs-actual', `$${(actualRevenue || 0).toLocaleString()}`);
  setText('rs-nash', `$${(nashRevenue || 0).toLocaleString()}`);
  setText('rs-curse', winnersCurse?.isWinnersCurse ? `⚠️ YES (-$${(winnersCurse.curseMagnitude || 0).toLocaleString()})` : '✅ None');
  setText('rs-true-value', `$${(trueCommonValue || 0).toLocaleString()}`);

  // Render bid table
  renderBidTable(allBids || [], result);

  // Render charts
  setTimeout(() => {
    renderResultsCharts(analytics);
  }, 100);
}

function renderBidTable(bids, result) {
  const table = document.getElementById('bid-table');
  if (!table) return;
  table.innerHTML = '';

  const sorted = [...bids].sort((a, b) => b.amount - a.amount);
  sorted.forEach((bid, i) => {
    const isWinner = result && bid.playerId === result.winner;
    const surplus = (bid.valuation || bid.amount) - bid.amount;
    const row = document.createElement('div');
    row.className = `bid-row${isWinner ? ' winner' : ''}`;
    row.style.setProperty('--i', i);
    row.innerHTML = `
      <div class="bid-rank">${isWinner ? '👑' : `#${i + 1}`}</div>
      <div class="bid-name">${bid.isBot ? '🤖 ' : ''}${bid.playerName}</div>
      <div class="bid-amount">$${bid.amount.toLocaleString()}</div>
      <div class="bid-valuation">$${(bid.valuation || 0).toLocaleString()}</div>
      <div class="bid-surplus ${surplus >= 0 ? 'pos' : 'neg'}">${surplus >= 0 ? '+' : ''}$${surplus.toLocaleString()}</div>
    `;
    table.appendChild(row);
  });
}

// ── UTILITY HELPERS ──────────────────────────────

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function playWinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (e) { /* Audio not available */ }
}

function playBidSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

// ── HOST BAR (AUCTION PAGE) ──────────────────────

function showAuctionHostBar(room) {
  const bar = document.getElementById('auction-host-controls');
  if (!bar) return;

  if (!AppState.isHost) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');

  // Populate kick dropdown
  updateAuctionKickDropdown(room.players);
}

function updateAuctionKickDropdown(players) {
  const sel = document.getElementById('auction-kick-select');
  if (!sel) return;
  const others = (players || []).filter(p => !p.isHost && !p.isBot);
  sel.innerHTML = others.length
    ? others.map(p => `<option value="${p.id}">${p.avatar} ${p.name}</option>`).join('')
    : '<option value="">— no players —</option>';
}
