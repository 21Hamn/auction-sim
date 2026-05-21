// client/public/js/auction.js
// Bidding actions, room actions, host controls

// ── ROOM CREATION & JOINING ──────────────────────

function createRoom() {
  const name = document.getElementById('create-name')?.value.trim();
  const type = document.getElementById('create-type')?.value;
  const theme = document.getElementById('create-theme')?.value;

  if (!name) { showToast('Please enter your name', 'error'); return; }

  AppState.myName = name;
  closeAllModals();
  emitJoinRoom(null, name, true, { auctionType: type, theme });
}

function joinRoom() {
  const name = document.getElementById('join-name')?.value.trim();
  const code = document.getElementById('join-code')?.value.trim().toUpperCase();

  if (!name) { showToast('Please enter your name', 'error'); return; }
  if (!code || code.length !== 6) { showToast('Please enter a valid 6-character room code', 'error'); return; }

  AppState.myName = name;
  closeAllModals();
  emitJoinRoom(code, name, false);
}

function leaveLobby() {
  emitLeaveRoom();
  AppState.room = null;
  AppState.myId = null;
  AppState.isHost = false;
  showPage('landing');
}

function copyRoomCode() {
  const code = AppState.roomCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Room code ${code} copied!`, 'success', 2000);
  }).catch(() => {
    showToast(`Room code: ${code}`, 'info');
  });
}

function toggleReady() {
  const btn = document.getElementById('btn-ready');
  if (btn) btn.classList.toggle('active');
  emitReadyToggle();
}

// ── AUCTION START ────────────────────────────────

function startAuction() {
  const settings = {
    auctionType: document.getElementById('setting-type')?.value || 'english',
    theme: document.getElementById('setting-theme')?.value || 'art',
    numRounds: parseInt(document.getElementById('setting-rounds')?.value) || 3,
    timerDuration: parseInt(document.getElementById('setting-timer')?.value) || 45,
    botCount: parseInt(document.getElementById('setting-bots')?.value) || 5,
    botsEnabled: (parseInt(document.getElementById('setting-bots')?.value) || 0) > 0,
    educationalMode: document.getElementById('setting-edu')?.checked || false
  };
  emitStartAuction(settings);
}

// ── ENGLISH AUCTION BIDDING ──────────────────────

function quickBid(increment) {
  if (!AppState.currentAuction) return;
  const base = AppState.currentAuction.currentPrice || 0;
  const amount = base + increment;
  const input = document.getElementById('bid-amount-english');
  if (input) input.value = amount;
  emitPlaceBid(amount);
  playBidSound();
}

function placeBidEnglish() {
  const input = document.getElementById('bid-amount-english');
  const amount = parseInt(input?.value);
  if (!amount || isNaN(amount)) {
    showToast('Enter a valid bid amount', 'error');
    return;
  }
  if (input) input.value = '';
  emitPlaceBid(amount);
  playBidSound();
}

function setAutoBid() {
  const input = document.getElementById('auto-bid-max');
  const max = parseInt(input?.value);
  if (!max || isNaN(max)) {
    showToast('Enter a valid auto-bid maximum', 'error');
    return;
  }
  AppState.autoBidMax = max;
  emitAutoBid(max);
}

function foldAuction() {
  if (!confirm('Are you sure you want to fold? You cannot bid again.')) return;
  emitFold();
  showToast('You folded from this round.', 'warning');
  document.getElementById('controls-english')?.classList.add('hidden');
}

// ── DUTCH AUCTION ────────────────────────────────

function buyNow() {
  if (!AppState.currentAuction) return;
  const price = AppState.currentAuction.currentPrice;
  const me = AppState.room?.players?.find(p => p.id === AppState.myId);
  if (me && me.balance < price) {
    showToast('Insufficient balance!', 'error');
    return;
  }
  emitBuyNow();
  playWinSound();
}

// ── SEALED BID ───────────────────────────────────

function placeSecretBid() {
  if (AppState.hasSubmittedSealedBid) {
    showToast('You already submitted a bid!', 'warning');
    return;
  }
  const input = document.getElementById('bid-amount-sealed');
  const amount = parseInt(input?.value);
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Enter a valid bid amount', 'error');
    return;
  }

  const me = AppState.room?.players?.find(p => p.id === AppState.myId);
  if (me && amount > me.balance) {
    showToast('Insufficient balance!', 'error');
    return;
  }

  emitPlaceBid(amount);
  AppState.hasSubmittedSealedBid = true;

  // Update UI
  document.getElementById('sealed-submitted')?.classList.remove('hidden');
  const btn = document.getElementById('btn-submit-sealed');
  if (btn) { btn.disabled = true; btn.textContent = 'SUBMITTED ✓'; }
  if (input) input.disabled = true;

  showToast(`Secret bid of $${amount.toLocaleString()} submitted!`, 'success');
  playBidSound();
}

// ── HOST CONTROLS ────────────────────────────────

function hostPauseTimer() {
  emitPauseTimer();
}

function showNewsModal() {
  document.getElementById('modal-news').classList.remove('hidden');
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function injectNews() {
  const headline = document.getElementById('news-headline')?.value.trim();
  const impact = document.getElementById('news-impact')?.value || 0;
  if (!headline) { showToast('Enter a headline', 'error'); return; }
  emitInjectNews(headline, Number(impact));
  closeAllModals();
  showToast('News injected!', 'success');
}

function updateImpactDisplay(val) {
  const el = document.getElementById('impact-display');
  if (el) el.textContent = `${val > 0 ? '+' : ''}${val}%`;
}

function kickSelectedPlayer() {
  const select = document.getElementById('kick-select');
  const playerId = select?.value;
  if (!playerId) { showToast('Select a player to kick', 'error'); return; }
  if (!confirm('Kick this player?')) return;
  emitKickPlayer(playerId);
}

// ── INPUT EVENT HANDLERS ─────────────────────────

function chatKeydown(e) {
  if (e.key === 'Enter') sendChat();
}

function auctionChatKeydown(e) {
  if (e.key === 'Enter') sendAuctionChat();
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input?.value.trim();
  if (!msg) return;
  emitChatMessage(msg);
  if (input) input.value = '';
}

function sendAuctionChat() {
  const input = document.getElementById('auction-chat-input');
  const msg = input?.value.trim();
  if (!msg) return;
  emitChatMessage(msg);
  if (input) input.value = '';
}

// ── KEYBOARD SHORTCUTS ───────────────────────────

document.addEventListener('keydown', (e) => {
  if (AppState.currentPage !== 'auction') return;
  if (e.target.tagName === 'INPUT') return;

  const auction = AppState.currentAuction;
  if (!auction) return;

  const auctionType = AppState.room?.settings?.auctionType;

  if (auctionType === AUCTION_TYPES.ENGLISH) {
    if (e.key === '1') quickBid(100);
    if (e.key === '2') quickBid(500);
    if (e.key === '3') quickBid(1000);
    if (e.key === 'f' || e.key === 'F') foldAuction();
  }
  if (auctionType === AUCTION_TYPES.DUTCH) {
    if (e.key === ' ' || e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      buyNow();
    }
  }
});

// ── HOST: KICK FROM AUCTION PAGE ─────────────────

function kickFromAuction() {
  const sel = document.getElementById('auction-kick-select');
  const playerId = sel?.value;
  if (!playerId) { showToast('Select a player to kick', 'error'); return; }
  if (!confirm('Kick this player?')) return;
  emitKickPlayer(playerId);
}
