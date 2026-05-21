// server/utils/auctionEngine.js
// Core auction logic and calculations

const {
  AUCTION_TYPES, GAME_STATES, STARTING_BALANCE,
  MIN_BID_INCREMENT, THEME_CONFIG
} = require('../../shared/constants');

/**
 * Generate a private valuation for a player based on theme and common value
 */
function generatePrivateValuation(theme, commonValue, riskProfile) {
  const config = THEME_CONFIG[theme];
  const [min, max] = config.valueRange;
  
  // Private value component
  const privateComponent = min + Math.random() * (max - min);
  
  // Common value component (shared uncertainty)
  const signal = commonValue + (Math.random() - 0.5) * commonValue * 0.4;
  
  // Blend based on common value factor
  const blended = config.commonValueFactor * signal + (1 - config.commonValueFactor) * privateComponent;
  
  // Apply risk profile adjustment
  const riskAdjust = riskProfile === 'aggressive' ? 1.15 : riskProfile === 'conservative' ? 0.85 : 1;
  
  return Math.round(blended * riskAdjust);
}

/**
 * Generate common value for an auction item
 */
function generateCommonValue(theme) {
  const config = THEME_CONFIG[theme];
  const [min, max] = config.valueRange;
  return Math.round(min + Math.random() * (max - min));
}

/**
 * Calculate Nash equilibrium bid for first-price sealed-bid auction
 * With N bidders and uniform [0,V] values: bid = (N-1)/N * v
 */
function nashEquilibriumBid(privateValue, numBidders) {
  if (numBidders <= 1) return privateValue;
  return Math.round(privateValue * (numBidders - 1) / numBidders);
}

/**
 * Calculate winner's curse: did winner overpay?
 */
function calculateWinnersCurse(winningBid, trueCommonValue, winnerValuation) {
  const profit = trueCommonValue - winningBid;
  const isWinnersCurse = profit < 0;
  const curseMagnitude = isWinnersCurse ? Math.abs(profit) : 0;
  
  return {
    trueValue: trueCommonValue,
    winningBid,
    profit,
    isWinnersCurse,
    curseMagnitude,
    privateEstimate: winnerValuation,
    estimationError: winnerValuation - trueCommonValue
  };
}

/**
 * Calculate auction efficiency (ratio of winner's value to highest valuation)
 */
function calculateEfficiency(winnerValuation, allValuations) {
  const maxValuation = Math.max(...allValuations);
  return maxValuation > 0 ? (winnerValuation / maxValuation) * 100 : 0;
}

/**
 * Calculate expected revenue equivalence
 * For IPV model: all standard auctions yield same expected revenue
 */
function calculateExpectedRevenue(valuations, auctionType) {
  const sorted = [...valuations].sort((a, b) => b - a);
  
  switch (auctionType) {
    case AUCTION_TYPES.ENGLISH:
    case AUCTION_TYPES.SECOND_PRICE_SEALED:
      // Second highest value (approximately)
      return sorted[1] || 0;
    case AUCTION_TYPES.FIRST_PRICE_SEALED:
    case AUCTION_TYPES.DUTCH:
      // Nash equilibrium bid of highest-value bidder
      return nashEquilibriumBid(sorted[0], valuations.length);
    default:
      return sorted[1] || 0;
  }
}

/**
 * Calculate bidder surplus (value - price paid)
 */
function calculateBidderSurplus(valuation, pricePaid) {
  return valuation - pricePaid;
}

/**
 * Analyze bid distribution statistics
 */
function analyzeBidDistribution(bids) {
  if (!bids || bids.length === 0) return null;
  
  const amounts = bids.map(b => b.amount);
  const sorted = [...amounts].sort((a, b) => a - b);
  
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  
  return { mean: Math.round(mean), stdDev: Math.round(stdDev), median, max, min };
}

/**
 * Calculate bidder aggressiveness score (0-100)
 */
function calculateAggressiveness(bid, privateValuation) {
  if (!privateValuation) return 50;
  const ratio = bid / privateValuation;
  return Math.min(100, Math.round(ratio * 100));
}

/**
 * Determine auction result based on type
 */
function determineAuctionResult(auctionType, bids, trueCommonValue) {
  if (!bids || bids.length === 0) return null;
  
  const validBids = bids.filter(b => b.amount > 0 && !b.folded);
  if (validBids.length === 0) return null;
  
  const sorted = [...validBids].sort((a, b) => b.amount - a.amount);
  const winner = sorted[0];
  const secondPlace = sorted[1];
  
  let pricePaid;
  switch (auctionType) {
    case AUCTION_TYPES.ENGLISH:
    case AUCTION_TYPES.FIRST_PRICE_SEALED:
    case AUCTION_TYPES.DUTCH:
      pricePaid = winner.amount;
      break;
    case AUCTION_TYPES.SECOND_PRICE_SEALED:
      pricePaid = secondPlace ? secondPlace.amount : winner.amount;
      break;
    default:
      pricePaid = winner.amount;
  }
  
  const winnersCurse = trueCommonValue 
    ? calculateWinnersCurse(pricePaid, trueCommonValue, winner.valuation || winner.amount)
    : null;
  
  return {
    winner: winner.playerId,
    winnerName: winner.playerName,
    winningBid: winner.amount,
    pricePaid,
    allBids: sorted,
    winnersCurse,
    revenue: pricePaid
  };
}

module.exports = {
  generatePrivateValuation,
  generateCommonValue,
  nashEquilibriumBid,
  calculateWinnersCurse,
  calculateEfficiency,
  calculateExpectedRevenue,
  calculateBidderSurplus,
  analyzeBidDistribution,
  calculateAggressiveness,
  determineAuctionResult
};
