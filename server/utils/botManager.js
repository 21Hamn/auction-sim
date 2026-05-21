// server/utils/botManager.js
// AI Bot Bidder System with multiple strategies

const { BOT_STRATEGIES, AUCTION_TYPES } = require('../../shared/constants');
const { nashEquilibriumBid } = require('./auctionEngine');

const BOT_NAMES = [
  'AlgoTrader', 'QuantBot', 'NeuralBidder', 'ArbitrageAI', 'MarketMaker',
  'ValueSeeker', 'RiskCalc', 'BayesBot', 'Nash99', 'OptimalBid',
  'ShadowTrader', 'GhostBidder', 'PhantomBull', 'CipherBid', 'ZeroSum',
  'SpecBot', 'AuctionAI', 'PriceFinder', 'MarginBot', 'EquilibriumX'
];

const BOT_AVATARS = ['🤖', '🦾', '🧠', '⚡', '🎯', '🔮', '💡', '🌐', '⚙️', '🔬'];

/**
 * Create a bot player with given strategy
 */
function createBot(strategy, balance, existingNames = []) {
  const availableNames = BOT_NAMES.filter(n => !existingNames.includes(n));
  const name = availableNames[Math.floor(Math.random() * availableNames.length)] || `Bot_${Math.random().toString(36).substr(2,5)}`;
  const avatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
  
  return {
    id: `bot_${Math.random().toString(36).substr(2, 9)}`,
    name,
    avatar,
    isBot: true,
    strategy,
    balance,
    score: 0,
    wins: 0,
    totalProfit: 0,
    bidsPlaced: 0,
    riskProfile: strategyToRisk(strategy),
    learningRate: 0.1,
    lastBid: 0,
    bidHistory: [],
    decisionDelay: strategyToDelay(strategy)
  };
}

function strategyToRisk(strategy) {
  const map = {
    [BOT_STRATEGIES.CONSERVATIVE]: 'conservative',
    [BOT_STRATEGIES.AGGRESSIVE]: 'aggressive',
    [BOT_STRATEGIES.SNIPER]: 'calculated',
    [BOT_STRATEGIES.IRRATIONAL]: 'irrational',
    [BOT_STRATEGIES.ADAPTIVE]: 'adaptive'
  };
  return map[strategy] || 'moderate';
}

function strategyToDelay(strategy) {
  const map = {
    [BOT_STRATEGIES.CONSERVATIVE]: [3000, 8000],
    [BOT_STRATEGIES.AGGRESSIVE]: [500, 2000],
    [BOT_STRATEGIES.SNIPER]: [100, 500], // acts at last second
    [BOT_STRATEGIES.IRRATIONAL]: [200, 15000],
    [BOT_STRATEGIES.ADAPTIVE]: [1000, 5000]
  };
  return map[strategy] || [2000, 6000];
}

/**
 * Calculate bot bid based on strategy and auction state
 */
function calculateBotBid(bot, auctionState, privateValuation) {
  const { currentPrice, auctionType, timeLeft, numBidders, startPrice } = auctionState;
  
  switch (bot.strategy) {
    case BOT_STRATEGIES.CONSERVATIVE:
      return conservativeBid(privateValuation, currentPrice, numBidders);
    
    case BOT_STRATEGIES.AGGRESSIVE:
      return aggressiveBid(privateValuation, currentPrice);
    
    case BOT_STRATEGIES.SNIPER:
      return sniperBid(privateValuation, currentPrice, timeLeft, auctionType);
    
    case BOT_STRATEGIES.IRRATIONAL:
      return irrationalBid(privateValuation, currentPrice, bot.balance);
    
    case BOT_STRATEGIES.ADAPTIVE:
      return adaptiveBid(bot, privateValuation, currentPrice, numBidders);
    
    default:
      return conservativeBid(privateValuation, currentPrice, numBidders);
  }
}

/** Conservative: bid close to Nash equilibrium */
function conservativeBid(valuation, currentPrice, numBidders) {
  const nashBid = nashEquilibriumBid(valuation, numBidders);
  if (nashBid <= currentPrice) return 0; // Won't bid above Nash
  // Bid slightly above current with some randomness
  const increment = Math.round(50 + Math.random() * 100);
  return Math.min(nashBid, currentPrice + increment);
}

/** Aggressive: bid up to 110% of valuation */
function aggressiveBid(valuation, currentPrice) {
  const maxBid = Math.round(valuation * (1.05 + Math.random() * 0.1));
  if (currentPrice >= maxBid) return 0;
  const increment = Math.round(100 + Math.random() * 300);
  return Math.min(maxBid, currentPrice + increment);
}

/** Sniper: waits, then bids just above current */
function sniperBid(valuation, currentPrice, timeLeft, auctionType) {
  // Sniper only acts in last 5 seconds for English auction
  if (auctionType === AUCTION_TYPES.ENGLISH && timeLeft > 5) return 0;
  if (currentPrice >= valuation) return 0;
  const increment = Math.round(50 + Math.random() * 100);
  return Math.min(valuation, currentPrice + increment);
}

/** Irrational: random behavior, sometimes overbids */
function irrationalBid(valuation, currentPrice, balance) {
  const roll = Math.random();
  if (roll < 0.3) return 0; // Sometimes passes
  if (roll < 0.6) {
    // Normal bid slightly over current
    return currentPrice + Math.round(50 + Math.random() * 200);
  }
  // Sometimes overbids dramatically (winner's curse behavior)
  const overbidFactor = 1.2 + Math.random() * 0.5;
  return Math.min(balance * 0.9, Math.round(valuation * overbidFactor));
}

/** Adaptive: learns from previous bids */
function adaptiveBid(bot, valuation, currentPrice, numBidders) {
  // Start with Nash equilibrium
  let targetBid = nashEquilibriumBid(valuation, numBidders);
  
  // Adjust based on win rate
  if (bot.wins === 0 && bot.bidsPlaced > 3) {
    // Not winning enough, be more aggressive
    targetBid = Math.round(targetBid * 1.1);
  } else if (bot.totalProfit < 0) {
    // Losing money, be more conservative
    targetBid = Math.round(targetBid * 0.9);
  }
  
  if (targetBid <= currentPrice) return 0;
  const increment = Math.round(50 + Math.random() * 150);
  return Math.min(targetBid, currentPrice + increment);
}

/**
 * Decide if bot should buy in Dutch auction
 */
function shouldBotBuyDutch(bot, currentPrice, privateValuation) {
  const surplus = privateValuation - currentPrice;
  const surplusRatio = surplus / privateValuation;
  
  switch (bot.strategy) {
    case BOT_STRATEGIES.AGGRESSIVE:
      return surplusRatio > 0.1 && Math.random() < 0.7;
    case BOT_STRATEGIES.CONSERVATIVE:
      return surplusRatio > 0.35 && Math.random() < 0.5;
    case BOT_STRATEGIES.IRRATIONAL:
      return Math.random() < 0.2;
    case BOT_STRATEGIES.ADAPTIVE:
      return surplusRatio > 0.2 && Math.random() < 0.6;
    default:
      return surplusRatio > 0.25 && Math.random() < 0.5;
  }
}

/**
 * Generate sealed bid for bot
 */
function generateSealedBid(bot, privateValuation, numBidders, auctionType) {
  switch (auctionType) {
    case AUCTION_TYPES.SECOND_PRICE_SEALED:
      // Dominant strategy: bid true value
      return Math.round(privateValuation * (0.95 + Math.random() * 0.1));
    
    case AUCTION_TYPES.FIRST_PRICE_SEALED:
      return calculateBotBid(bot, { 
        currentPrice: 0, auctionType, timeLeft: 0, numBidders, startPrice: 0 
      }, privateValuation);
    
    default:
      return Math.round(privateValuation * 0.8);
  }
}

/**
 * Fill room with bots up to target count
 */
function fillWithBots(currentPlayers, targetCount, balance) {
  const bots = [];
  const existingNames = currentPlayers.map(p => p.name);
  const strategies = Object.values(BOT_STRATEGIES);
  
  for (let i = currentPlayers.length; i < targetCount; i++) {
    const strategy = strategies[i % strategies.length];
    bots.push(createBot(strategy, balance, [...existingNames, ...bots.map(b => b.name)]));
  }
  
  return bots;
}

module.exports = {
  createBot, calculateBotBid, shouldBotBuyDutch,
  generateSealedBid, fillWithBots, BOT_STRATEGIES
};
