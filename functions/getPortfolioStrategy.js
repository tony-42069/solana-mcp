const { query } = require('../utils/database');
const { getTokenLiquidity } = require('../utils/tokenUtils');
const { analyzeTokenSafety } = require('../utils/safetyUtils');

/**
 * Generate a personalized memecoin portfolio strategy based on risk profile and market data
 */
async function handler({ mainnetConnection, logger, parameters }) {
  const { riskTolerance, investmentSize, existingPortfolio } = parameters;
  
  try {
    logger.info(`Generating portfolio strategy with risk tolerance: ${riskTolerance}`);
    
    // Get recent memecoin data from our database
    const recentMemecoins = await query(`
      SELECT m.*, 
             (SELECT overall_safety_score FROM safety_scores WHERE token_address = m.address) AS safety_score
      FROM tokens m
      WHERE m.is_memecoin = 1
      ORDER BY creation_date DESC
      LIMIT 100
    `);
    
    logger.info(`Found ${recentMemecoins.length} recent memecoins for analysis`);
    
    // Process each token to get current market data and complete safety analysis if needed
    const processedTokens = [];
    
    for (const token of recentMemecoins) {
      try {
        // Get current market data
        const marketData = await getTokenLiquidity(token.address);
        
        // If token has no safety score yet, run safety analysis
        let safetyScore = token.safety_score;
        if (!safetyScore) {
          const safetyAnalysis = await analyzeTokenSafety(mainnetConnection, token.address);
          safetyScore = safetyAnalysis.safetyScore;
        }
        
        // Calculate a "potential" score based on various factors
        const noveltyFactor = calculateNoveltyFactor(token.creation_date || token.created_at);
        const marketFactor = calculateMarketFactor(marketData);
        const riskAdjustedScore = calculateRiskAdjustedScore(safetyScore, noveltyFactor, marketFactor);
        
        // Get social signals (from database, aggregated)
        const socialSignals = await query(`
          SELECT AVG(sentiment_score) as avg_sentiment, 
                 SUM(mentions) as total_mentions,
                 SUM(engagement_score) as total_engagement
          FROM social_signals
          WHERE token_address = ?
          AND timestamp > datetime('now', '-7 days')
        `, [token.address]);
        
        const socialScore = calculateSocialScore(socialSignals[0]);
        
        // Get meme correlations
        const memeCorrelations = await query(`
          SELECT meme_name, correlation_score
          FROM meme_correlations
          WHERE token_address = ?
          ORDER BY correlation_score DESC
          LIMIT 5
        `, [token.address]);
        
        const memeScore = calculateMemeScore(memeCorrelations);
        
        // Calculate final opportunity score
        const opportunityScore = (
          riskAdjustedScore * 0.4 +
          socialScore * 0.3 +
          memeScore * 0.3
        );
        
        // Add to processed tokens
        processedTokens.push({
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          safetyScore,
          marketData,
          opportunityScore,
          components: {
            noveltyFactor,
            marketFactor,
            riskAdjustedScore,
            socialScore,
            memeScore
          },
          memeCorrelations: memeCorrelations.length > 0 ? memeCorrelations : undefined
        });
      } catch (tokenError) {
        logger.error(`Error processing token ${token.address}: ${tokenError.message}`);
        // Skip this token
      }
    }
    
    // Sort tokens by opportunity score
    processedTokens.sort((a, b) => b.opportunityScore - a.opportunityScore);
    
    // Generate portfolio allocation based on risk tolerance
    const portfolio = generatePortfolioAllocation(
      processedTokens,
      riskTolerance,
      investmentSize,
      existingPortfolio
    );
    
    // Generate explanation and strategy
    const strategy = generateStrategy(portfolio, riskTolerance);
    
    logger.info(`Portfolio strategy generated with ${portfolio.recommendations.length} recommendations`);
    
    return {
      riskTolerance,
      investmentSize,
      strategy,
      portfolio
    };
  } catch (error) {
    logger.error(`Error in getPortfolioStrategy: ${error.message}`);
    throw new Error(`Failed to generate portfolio strategy: ${error.message}`);
  }
}

/**
 * Calculate a novelty factor based on token age
 * @param {string} createdAt - Token creation date
 * @returns {number} - Novelty factor (0-1)
 */
function calculateNoveltyFactor(createdAt) {
  const creationDate = new Date(createdAt);
  const now = new Date();
  const ageInDays = (now - creationDate) / (1000 * 60 * 60 * 24);
  
  // Newer tokens get higher novelty score
  if (ageInDays < 1) {
    return 1.0; // Less than a day old - maximum novelty
  } else if (ageInDays < 7) {
    return 0.8; // Less than a week old - high novelty
  } else if (ageInDays < 30) {
    return 0.6; // Less than a month old - medium novelty
  } else if (ageInDays < 90) {
    return 0.4; // Less than 3 months old - lower novelty
  } else {
    return 0.2; // Older than 3 months - low novelty
  }
}

/**
 * Calculate a market factor based on token market data
 * @param {Object} marketData - Token market data
 * @returns {number} - Market factor (0-1)
 */
function calculateMarketFactor(marketData) {
  // Consider price trends, volume, and liquidity
  const priceChangeFactor = marketData.priceChange24h > 0 ? 
    Math.min(1, marketData.priceChange24h / 100) + 0.5 : // Positive change
    Math.max(0, 0.5 - Math.abs(marketData.priceChange24h) / 100); // Negative change
  
  // Volume factor (normalized)
  const volumeFactor = Math.min(1, Math.log10(marketData.volume24h + 1) / 6);
  
  // Liquidity factor (normalized)
  const liquidityFactor = Math.min(1, Math.log10(marketData.liquidity + 1) / 6);
  
  // Weighted average
  return (priceChangeFactor * 0.4) + (volumeFactor * 0.3) + (liquidityFactor * 0.3);
}

/**
 * Calculate a risk-adjusted score
 * @param {number} safetyScore - Token safety score
 * @param {number} noveltyFactor - Token novelty factor
 * @param {number} marketFactor - Token market factor
 * @returns {number} - Risk-adjusted score (0-1)
 */
function calculateRiskAdjustedScore(safetyScore, noveltyFactor, marketFactor) {
  // Safety is on a 0-100 scale, normalize to 0-1
  const normalizedSafety = safetyScore / 100;
  
  // Weighted combination
  return (normalizedSafety * 0.5) + (noveltyFactor * 0.25) + (marketFactor * 0.25);
}

/**
 * Calculate a social score based on social signals
 * @param {Object} socialData - Social signals data
 * @returns {number} - Social score (0-1)
 */
function calculateSocialScore(socialData) {
  if (!socialData || !socialData.total_mentions) {
    return 0.3; // Default middle-low score if no data
  }
  
  // Mentions factor (normalized)
  const mentionsFactor = Math.min(1, Math.log10(socialData.total_mentions + 1) / 3);
  
  // Engagement factor (normalized)
  const engagementFactor = Math.min(1, Math.log10(socialData.total_engagement + 1) / 4);
  
  // Sentiment factor (convert from -1:1 to 0:1 scale)
  const sentimentFactor = socialData.avg_sentiment ? 
    (socialData.avg_sentiment + 1) / 2 : 
    0.5; // Neutral if no data
  
  // Weighted average
  return (mentionsFactor * 0.4) + (engagementFactor * 0.3) + (sentimentFactor * 0.3);
}

/**
 * Calculate a meme score based on meme correlations
 * @param {Array} memeCorrelations - Meme correlation data
 * @returns {number} - Meme score (0-1)
 */
function calculateMemeScore(memeCorrelations) {
  if (!memeCorrelations || memeCorrelations.length === 0) {
    return 0.2; // Default low score if no correlations
  }
  
  // Average correlation score (correlations are already 0-1)
  const avgCorrelation = memeCorrelations.reduce(
    (sum, item) => sum + (item.correlation_score || 0), 
    0
  ) / memeCorrelations.length;
  
  // Bonus for having multiple correlations
  const countBonus = Math.min(0.3, memeCorrelations.length * 0.05);
  
  return Math.min(1, avgCorrelation + countBonus);
}

/**
 * Generate portfolio allocation based on processed tokens and risk tolerance
 * @param {Array} processedTokens - Processed token data
 * @param {string} riskTolerance - Risk tolerance level
 * @param {number} investmentSize - Total investment size in USD
 * @param {Array} existingPortfolio - Existing portfolio tokens
 * @returns {Object} - Portfolio allocation
 */
function generatePortfolioAllocation(processedTokens, riskTolerance, investmentSize, existingPortfolio) {
  // Define allocation parameters based on risk tolerance
  let parameters = {
    maxTokens: 5,
    estabRatio: 0.6, // Established tokens
    newRatio: 0.3,   // New tokens
    specRatio: 0.1,   // Speculative tokens
    minSafetyScore: 60
  };
  
  // Adjust based on risk tolerance
  switch (riskTolerance) {
    case 'conservative':
      parameters = {
        maxTokens: 3,
        estabRatio: 0.8,
        newRatio: 0.2,
        specRatio: 0,
        minSafetyScore: 70
      };
      break;
    case 'moderate':
      // Keep defaults
      break;
    case 'aggressive':
      parameters = {
        maxTokens: 7,
        estabRatio: 0.4,
        newRatio: 0.4,
        specRatio: 0.2,
        minSafetyScore: 40
      };
      break;
    case 'very_aggressive':
      parameters = {
        maxTokens: 10,
        estabRatio: 0.2,
        newRatio: 0.5,
        specRatio: 0.3,
        minSafetyScore: 30
      };
      break;
  }
  
  // Categorize tokens
  const established = processedTokens
    .filter(t => t.safetyScore >= parameters.minSafetyScore)
    .slice(0, Math.max(1, Math.floor(parameters.maxTokens * 0.4)));
  
  const newTokens = processedTokens
    .filter(t => t.safetyScore >= parameters.minSafetyScore * 0.7 && t.safetyScore < parameters.minSafetyScore)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, Math.max(1, Math.floor(parameters.maxTokens * 0.4)));
  
  const speculative = processedTokens
    .filter(t => t.safetyScore < parameters.minSafetyScore * 0.7)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, Math.max(1, Math.floor(parameters.maxTokens * 0.2)));
  
  // Filter out any tokens already in portfolio if provided
  const existingAddresses = new Set(
    (existingPortfolio || []).map(p => p.address)
  );
  
  const filteredEstablished = established.filter(t => !existingAddresses.has(t.address));
  const filteredNew = newTokens.filter(t => !existingAddresses.has(t.address));
  const filteredSpeculative = speculative.filter(t => !existingAddresses.has(t.address));
  
  // Generate allocation
  const allocations = [];
  let remainingAllocation = investmentSize;
  
  // Established tokens
  const estabAllocation = investmentSize * parameters.estabRatio;
  remainingAllocation -= estabAllocation;
  
  filteredEstablished.forEach((token, index) => {
    // Weight by position in the list
    const weight = 1 - (index / filteredEstablished.length) * 0.5;
    const amount = (estabAllocation * weight) / filteredEstablished.length;
    
    allocations.push({
      token,
      amount: Math.round(amount * 100) / 100,
      category: 'established',
      reasoning: 'Lower risk established memecoin with good market metrics'
    });
  });
  
  // New tokens
  const newAllocation = investmentSize * parameters.newRatio;
  remainingAllocation -= newAllocation;
  
  filteredNew.forEach((token, index) => {
    // Weight by position in the list
    const weight = 1 - (index / filteredNew.length) * 0.5;
    const amount = (newAllocation * weight) / filteredNew.length;
    
    allocations.push({
      token,
      amount: Math.round(amount * 100) / 100,
      category: 'new',
      reasoning: 'Moderate risk newer memecoin showing promising signals'
    });
  });
  
  // Speculative tokens
  filteredSpeculative.forEach((token, index) => {
    // Weight by position in the list
    const weight = 1 - (index / filteredSpeculative.length) * 0.5;
    const amount = (remainingAllocation * weight) / filteredSpeculative.length;
    
    allocations.push({
      token,
      amount: Math.round(amount * 100) / 100,
      category: 'speculative',
      reasoning: 'Higher risk speculative memecoin with potential for significant returns'
    });
  });
  
  // Generate specific recommendations
  const recommendations = allocations.map(allocation => ({
    tokenAddress: allocation.token.address,
    name: allocation.token.name,
    symbol: allocation.token.symbol,
    amount: allocation.amount,
    percentage: (allocation.amount / investmentSize * 100).toFixed(1) + '%',
    reasoning: allocation.reasoning,
    opportunityScore: allocation.token.opportunityScore.toFixed(2),
    safetyScore: allocation.token.safetyScore
  }));
  
  return {
    totalInvestment: investmentSize,
    riskTolerance,
    recommendations: recommendations,
    categories: {
      established: Math.round(parameters.estabRatio * 100),
      new: Math.round(parameters.newRatio * 100),
      speculative: Math.round(parameters.specRatio * 100)
    }
  };
}

/**
 * Generate a strategy explanation based on portfolio and risk tolerance
 * @param {Object} portfolio - Generated portfolio allocation
 * @param {string} riskTolerance - Risk tolerance level
 * @returns {Object} - Strategy explanation
 */
function generateStrategy(portfolio, riskTolerance) {
  // Base strategy text on risk tolerance
  let baseStrategy = "";
  let entryStrategy = "";
  let exitStrategy = "";
  let timeHorizon = "";
  
  switch (riskTolerance) {
    case 'conservative':
      baseStrategy = "Focus on established memecoins with proven market presence and higher safety scores. Minimize exposure to newer, unproven tokens.";
      entryStrategy = "Dollar-cost average into positions over 1-2 weeks rather than buying all at once.";
      exitStrategy = "Set conservative profit targets of 20-50% and use stop losses at 15-20% below entry.";
      timeHorizon = "Medium-term: Hold positions for 1-3 months, reassessing based on continued performance.";
      break;
    case 'moderate':
      baseStrategy = "Balanced approach with majority in established memecoins but allowing for moderate exposure to newer tokens with strong signals.";
      entryStrategy = "Enter positions in 2-3 tranches, with larger allocations to safer tokens first.";
      exitStrategy = "Set profit targets of 50-100% for established tokens and 100-200% for newer ones. Use trailing stops of 20-25%.";
      timeHorizon = "Mixed: Hold established positions for 1-3 months, newer tokens for 2-6 weeks depending on momentum.";
      break;
    case 'aggressive':
      baseStrategy = "Growth-focused approach with significant allocation to newer tokens showing strong social signals and meme correlation. Still maintain some safer positions as anchors.";
      entryStrategy = "More aggressive entry with 60-70% of position at once for tokens with strong momentum.";
      exitStrategy = "Set tiered profit-taking at 100%, 200%, and 300%+. Use looser stops of 30-35% or based on key support levels.";
      timeHorizon = "Shorter-term: Actively monitor positions daily, with average hold times of 2-4 weeks for most positions.";
      break;
    case 'very_aggressive':
      baseStrategy = "Maximum growth potential with heavy focus on emerging tokens with strong meme correlation and social signals. Minimal allocation to established tokens.";
      entryStrategy = "Rapid entry on tokens showing momentum, with focus on catching early moves in trending meme themes.";
      exitStrategy = "Set partial profit-taking at 100%, but let winners run with trailing stops. Quickly cut losses on tokens that don't gain traction.";
      timeHorizon = "Very short-term: Actively trade positions with average hold times of 1-2 weeks, rotating into new opportunities quickly.";
      break;
  }
  
  return {
    overallStrategy: baseStrategy,
    entryStrategy,
    exitStrategy,
    timeHorizon,
    keyRisks: [
      "All memecoins carry significant volatility and risk of permanent loss",
      "Market sentiment can shift rapidly with little warning",
      "Regulatory changes could impact the entire memecoin sector",
      "Liquidity can disappear quickly, especially for newer tokens",
      "Always use proper position sizing and only invest what you can afford to lose"
    ]
  };
}

// MCP function metadata
const description = "Generate a personalized memecoin portfolio strategy based on risk profile";
const parameters = {
  type: "object",
  properties: {
    riskTolerance: {
      type: "string",
      enum: ["conservative", "moderate", "aggressive", "very_aggressive"],
      description: "Risk tolerance level for the portfolio strategy"
    },
    investmentSize: {
      type: "number",
      description: "Total investment size in USD"
    },
    existingPortfolio: {
      type: "array",
      description: "Optional: Array of tokens already in portfolio to exclude from recommendations",
      items: {
        type: "object",
        properties: {
          address: { type: "string" },
          amount: { type: "number" }
        }
      }
    }
  },
  required: ["riskTolerance", "investmentSize"]
};

module.exports = {
  handler,
  description,
  parameters
};
