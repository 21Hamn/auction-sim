// client/public/js/educational.js
// Educational content and strategy guides

const EDU_CONTENT = {
  english: {
    title: 'English Auction',
    content: `
      <h4>HOW IT WORKS</h4>
      <p>Bids rise openly. Highest bid when timer expires wins.</p>
      
      <h4>OPTIMAL STRATEGY</h4>
      <p>Bid up to your <span class="highlight">true valuation</span>. Never exceed it — that creates loss.</p>
      
      <h4>KEY CONCEPTS</h4>
      <p>• <span class="highlight">Jump bidding</span>: Signal high value to deter rivals</p>
      <p>• <span class="highlight">Sniping</span>: Bid at last second to win cheaply</p>
      <p>• <span class="highlight">Auto-bid</span>: Set max and let system bid for you</p>
      
      <h4>REVENUE EQUIVALENCE</h4>
      <p>Expected revenue ≈ Second-Price Sealed (Vickrey)</p>
    `
  },
  dutch: {
    title: 'Dutch Auction',
    content: `
      <h4>HOW IT WORKS</h4>
      <p>Price drops from high. First to click BUY wins at current price.</p>
      
      <h4>OPTIMAL STRATEGY</h4>
      <p>Buy when price = <span class="highlight">(N-1)/N × your valuation</span> where N = bidders.</p>
      
      <h4>TIMING IS EVERYTHING</h4>
      <p>• Too early → overpay</p>
      <p>• Too late → someone else wins</p>
      <p>• Sweet spot → maximize surplus</p>
      
      <h4>EQUIVALENCE</h4>
      <p>Strategically identical to First-Price Sealed Bid.</p>
    `
  },
  first_price_sealed: {
    title: 'First-Price Sealed Bid',
    content: `
      <h4>HOW IT WORKS</h4>
      <p>Everyone submits secret bids. Highest bid wins, pays their OWN bid.</p>
      
      <h4>NASH EQUILIBRIUM</h4>
      <p>Optimal bid = <span class="highlight">(N-1)/N × your valuation</span></p>
      <p>With 5 bidders: bid 80% of your value</p>
      <p>With 10 bidders: bid 90% of your value</p>
      
      <h4>BID SHADING</h4>
      <p>Always bid <em>below</em> true value. The gap = expected surplus.</p>
      
      <h4>WHY SHADE?</h4>
      <p>Bidding true value → zero profit if you win. Shade down for positive expected profit.</p>
    `
  },
  second_price_sealed: {
    title: 'Vickrey (2nd-Price Sealed)',
    content: `
      <h4>HOW IT WORKS</h4>
      <p>Highest bid wins but pays the <span class="highlight">second-highest bid</span>.</p>
      
      <h4>DOMINANT STRATEGY</h4>
      <p>Bid exactly your <span class="highlight">true valuation</span>. This is provably optimal regardless of others' bids.</p>
      
      <h4>WHY TRUTH-TELLING WORKS</h4>
      <p>• Overbid your value → risk paying more than it's worth</p>
      <p>• Underbid → might lose a profitable auction</p>
      <p>• Bid true value → optimal in ALL scenarios</p>
      
      <h4>VICKREY'S THEOREM</h4>
      <p>Truth-telling is a weakly dominant strategy. Expected revenue ≈ English auction.</p>
    `
  }
};

function updateEducationalPanel(auctionType, valuation) {
  const panel = document.getElementById('edu-panel');
  const content = document.getElementById('edu-content');
  if (!panel || !content) return;

  const edu = EDU_CONTENT[auctionType];
  if (!edu) { panel.classList.add('hidden'); return; }

  panel.classList.remove('hidden');

  let extraContent = '';
  if (valuation) {
    const numBidders = AppState.room?.players?.length || 5;
    const nashBid = Math.round(valuation * (numBidders - 1) / numBidders);
    extraContent = `
      <h4>YOUR NUMBERS</h4>
      <p>Your valuation: <span class="highlight">$${valuation.toLocaleString()}</span></p>
      <p>Nash optimal bid: <span class="highlight">$${nashBid.toLocaleString()}</span></p>
      <p>Risk profile: <span class="highlight">${AppState.riskProfile || 'moderate'}</span></p>
    `;
  }

  content.innerHTML = edu.content + extraContent;
}
