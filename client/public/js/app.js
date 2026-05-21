// client/public/js/app.js
// Main application entry point

document.addEventListener('DOMContentLoaded', () => {
  // Initialize socket
  initSocket();

  // Bind Enter key for modals
  document.getElementById('create-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') createRoom();
  });
  document.getElementById('join-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('join-code')?.focus();
  });
  document.getElementById('join-code')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') joinRoom();
    // Auto-uppercase
    setTimeout(() => {
      if (e.target) e.target.value = e.target.value.toUpperCase();
    }, 0);
  });
  document.getElementById('news-headline')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') injectNews();
  });

  // Close modals with Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });

  // Prevent backdrop click from propagating to modal content
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => e.stopPropagation());
  });

  // Init bid chart placeholder
  initBidDistributionChart();

  // Fetch initial global stats via HTTP (backup)
  fetch('/api/stats')
    .then(r => r.json())
    .then(stats => updateGlobalStats(stats))
    .catch(() => {}); // Ignore — socket will provide

  console.log('[APP] AuctionSim initialized 🔨');
});
