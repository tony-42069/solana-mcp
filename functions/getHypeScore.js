const { searchTwitterMentions, crawlForTokenMentions } = require('../utils/socialUtils');
const { getTokenLiquidity } = require('../utils/tokenUtils');
const { queryOne, execute } = require('../utils/database');

/**
 * Calculate a "hype score" for a given memecoin based on social signals and on-chain activity
 */
async function handler({ mainnetConnection, logger, parameters }) {
  const { tokenAddress } = parameters;
  
  if (!tokenAddress) {
    throw new Error('Token address is required');
  }
  
  try {
    logger.info(`Calculating hype score for token: ${tokenAddress}`);
    
    // Get token information from our database
    const tokenInfo = await queryOne('SELECT * FROM tokens WHERE address = ?', [tokenAddress]);
    
    if (!tokenInfo) {
      throw new Error(`Token not found: ${tokenAddress}`);
    }
    
    // Get social signals
    logger.info(`Getting social signals for ${tokenInfo.name} (${tokenInfo.symbol})`);
    const twitterData = await searchTwitterMentions(tokenInfo.symbol, tokenInfo.name);
    const platformMentions = await crawlForTokenMentions(tokenInfo.symbol, tokenInfo.name);
    
    // Get on-chain metrics
    const liquidityData = await getTokenLiquidity(tokenAddress);
    
    // Calculate total social engagement
    const socialEngagement = twitterData.engagement + 
      (platformMentions.reddit.count * 5) + 
      (platformMentions.telegram.count * 3);
      
    // Calculate average sentiment (weighted)
    const twitterWeight = 0.5;
    const redditWeight = 0.3;
    const telegramWeight = 0.2;
    
    let weightedSentiment = 0;
    let totalWeight = 0;
    
    if (twitterData.count > 0) {
      weightedSentiment += twitterData.sentiment * twitterWeight;
      totalWeight += twitterWeight;
    }
    
    if (platformMentions.reddit.count > 0) {
      weightedSentiment += platformMentions.reddit.sentiment * redditWeight;
      totalWeight += redditWeight;
    }
    
    if (platformMentions.telegram.count > 0) {
      weightedSentiment += platformMentions.telegram.sentiment * telegramWeight;
      totalWeight += telegramWeight;
    }
    
    const averageSentiment = totalWeight > 0 ? weightedSentiment / totalWeight : 0;
    
    // Calculate age factor (newer tokens get higher scores)
    const tokenCreatedDate = new Date(tokenInfo.created_at);
    const now = new Date();
    const ageInDays = (now - tokenCreatedDate) / (1000 * 60 * 60 * 24);
    const ageFactor = Math.max(0.5, Math.min(1.5, 2 - (ageInDays / 30))); // Higher for newer tokens, 1.0 at 30 days
    
    // Calculate volume factor
    const volumeFactor = Math.min(2, Math.max(0.2, Math.log10(liquidityData.volume24h + 1) / 4));
    
    // Calculate price change factor
    const priceChangeFactor = Math.min(2, Math.max(0.5, (liquidityData.priceChange24h + 100) / 100));
    
    // Calculate social engagement factor
    const socialEngagementFactor = Math.min(2, Math.max(0.2, Math.log10(socialEngagement + 1) / 2));
    
    // Calculate sentiment factor (transform -1 to 1 scale to 0.5 to 1.5 scale)
    const sentimentFactor = averageSentiment * 0.5 + 1;
    
    // Calculate final hype score (0-100)
    const hypeScore = Math.min(100, Math.round(
      20 * ageFactor * 
      volumeFactor * 
      priceChangeFactor * 
      socialEngagementFactor * 
      sentimentFactor
    ));
    
    // Save the social signals to our database
    await execute(
      `INSERT INTO social_signals 
       (token_address, platform, mentions, sentiment_score, engagement_score) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        tokenAddress,
        'twitter',
        twitterData.count,
        twitterData.sentiment,
        twitterData.engagement
      ]
    );
    
    logger.info(`Hype score calculated for ${tokenInfo.name}: ${hypeScore}`);
    
    return {
      tokenAddress,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      hypeScore,
      components: {
        socialEngagement: {
          twitter: twitterData.count,
          reddit: platformMentions.reddit.count,
          telegram: platformMentions.telegram.count,
          totalEngagement: socialEngagement
        },
        sentiment: {
          average: averageSentiment,
          twitter: twitterData.sentiment,
          reddit: platformMentions.reddit.sentiment,
          telegram: platformMentions.telegram.sentiment
        },
        marketMetrics: {
          age: ageInDays.toFixed(1),
          volume24h: liquidityData.volume24h,
          priceChange24h: liquidityData.priceChange24h,
          liquidity: liquidityData.liquidity
        },
        factors: {
          ageFactor: ageFactor.toFixed(2),
          volumeFactor: volumeFactor.toFixed(2),
          priceChangeFactor: priceChangeFactor.toFixed(2),
          socialEngagementFactor: socialEngagementFactor.toFixed(2),
          sentimentFactor: sentimentFactor.toFixed(2)
        }
      },
      recentMentions: {
        twitter: twitterData.sources?.slice(0, 3) || [],
        reddit: platformMentions.reddit.posts?.slice(0, 3) || []
      }
    };
  } catch (error) {
    logger.error(`Error in getHypeScore: ${error.message}`);
    throw new Error(`Failed to calculate hype score: ${error.message}`);
  }
}

// MCP function metadata
const description = "Calculate a 'hype score' for a memecoin based on social signals and on-chain activity";
const parameters = {
  type: "object",
  properties: {
    tokenAddress: {
      type: "string",
      description: "The Solana address of the memecoin token"
    }
  },
  required: ["tokenAddress"]
};

module.exports = {
  handler,
  description,
  parameters
};
