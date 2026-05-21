// client/public/js/charts.js
// Chart.js visualizations for auction analytics

// Chart instances (to destroy before re-render)
const charts = {};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: 'rgba(232,237,242,0.6)',
        font: { family: 'Space Mono', size: 10 },
        boxWidth: 12
      }
    },
    tooltip: {
      backgroundColor: 'rgba(13,17,23,0.95)',
      borderColor: 'rgba(0,255,136,0.3)',
      borderWidth: 1,
      titleColor: '#00ff88',
      bodyColor: 'rgba(232,237,242,0.8)',
      titleFont: { family: 'Orbitron', size: 10 },
      bodyFont: { family: 'Space Mono', size: 10 },
      padding: 10
    }
  },
  scales: {
    x: {
      ticks: { color: 'rgba(232,237,242,0.4)', font: { family: 'Space Mono', size: 9 } },
      grid: { color: 'rgba(255,255,255,0.04)' }
    },
    y: {
      ticks: { color: 'rgba(232,237,242,0.4)', font: { family: 'Space Mono', size: 9 } },
      grid: { color: 'rgba(255,255,255,0.04)' }
    }
  }
};

// ── LIVE BID DISTRIBUTION (AUCTION PAGE) ─────────

function initBidDistributionChart() {
  const canvas = document.getElementById('bid-chart');
  if (!canvas) return;

  destroyChart('bid');

  const ctx = canvas.getContext('2d');
  charts['bid'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Bid Amount',
        data: [],
        backgroundColor: 'rgba(0,255,136,0.3)',
        borderColor: 'rgba(0,255,136,0.8)',
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false }
      },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, display: false },
        y: { ...CHART_DEFAULTS.scales.y }
      }
    }
  });
}

function updateBidDistributionChart(bids) {
  const chart = charts['bid'];
  if (!chart || !bids || bids.length === 0) return;

  const sorted = [...bids].sort((a, b) => a.amount - b.amount);
  chart.data.labels = sorted.map(b => b.playerName.substring(0, 6));
  chart.data.datasets[0].data = sorted.map(b => b.amount);
  chart.data.datasets[0].backgroundColor = sorted.map((b, i) =>
    i === sorted.length - 1 ? 'rgba(255,215,0,0.5)' : 'rgba(0,255,136,0.3)'
  );
  chart.update('none');
}

// ── RESULTS: BID VS VALUATION CHART ─────────────

function renderBidVsValuationChart(bids, result) {
  const canvas = document.getElementById('results-bid-chart');
  if (!canvas) return;

  destroyChart('results-bid');

  const sorted = [...(bids || [])].sort((a, b) => b.amount - a.amount);
  const labels = sorted.map(b => (b.playerName || '?').substring(0, 8));
  const bidAmounts = sorted.map(b => b.amount);
  const valuations = sorted.map(b => b.valuation || b.amount);
  const bgColors = sorted.map(b =>
    result && b.playerId === result.winner
      ? 'rgba(255,215,0,0.7)'
      : 'rgba(0,255,136,0.3)'
  );

  const ctx = canvas.getContext('2d');
  charts['results-bid'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Bid',
          data: bidAmounts,
          backgroundColor: bgColors,
          borderColor: 'rgba(0,255,136,0.8)',
          borderWidth: 1,
          borderRadius: 3,
          order: 1
        },
        {
          label: 'Valuation',
          data: valuations,
          type: 'line',
          borderColor: 'rgba(0,170,255,0.8)',
          backgroundColor: 'rgba(0,170,255,0.1)',
          pointBackgroundColor: 'rgba(0,170,255,0.9)',
          borderWidth: 2,
          pointRadius: 4,
          order: 0
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x },
        y: {
          ...CHART_DEFAULTS.scales.y,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: v => `$${(v / 1000).toFixed(1)}K`
          }
        }
      }
    }
  });
}

// ── RESULTS: REVENUE ANALYSIS CHART ─────────────

function renderRevenueChart(analytics) {
  const canvas = document.getElementById('results-revenue-chart');
  if (!canvas) return;

  destroyChart('results-rev');

  const { actualRevenue, expectedRevenue, nashRevenue } = analytics;

  const ctx = canvas.getContext('2d');
  charts['results-rev'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Actual Revenue', 'Expected Rev.', 'Nash Eq. Rev.'],
      datasets: [{
        data: [actualRevenue || 0, expectedRevenue || 0, nashRevenue || 0],
        backgroundColor: [
          'rgba(255,215,0,0.6)',
          'rgba(0,170,255,0.6)',
          'rgba(0,255,136,0.6)'
        ],
        borderColor: [
          'rgba(255,215,0,1)',
          'rgba(0,170,255,1)',
          'rgba(0,255,136,1)'
        ],
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false }
      },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x },
        y: {
          ...CHART_DEFAULTS.scales.y,
          ticks: {
            ...CHART_DEFAULTS.scales.y.ticks,
            callback: v => `$${v.toLocaleString()}`
          }
        }
      }
    }
  });
}

// ── RENDER ALL RESULTS CHARTS ────────────────────

function renderResultsCharts(analytics) {
  if (!analytics) return;
  renderBidVsValuationChart(analytics.allBids, analytics.result);
  renderRevenueChart(analytics);
  if (analytics.allBids) {
    updateBidDistributionChart(analytics.allBids);
  }
}

// ── HELPER ───────────────────────────────────────

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}
