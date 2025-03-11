const { trackTrendingMemes, calculateMemeCorrelation } = require('../utils/socialUtils');
const { queryOne, query, execute } = require('../utils/database');

/**
 * Analyze correlation between memecoin and current trending memes
 */
async function handler({ logger, parameters }) {
  const { tokenAddress, includeTrendingReport } = parameters;
  
  try {
    logger.info(`Analyzing meme correlations ${tokenAddress ? `for token: ${tokenAddress}` : 'for all tokens'}`);
    
    // Get trending memes first
    const trendingMemes = await trackTrendingMemes();
    logger.info(`Found ${trendingMemes.length} trending memes`);
    
    // Tokens to analyze
    let tokens = [];
    
    if (tokenAddress) {
      // Just analyze the specified token
      const tokenInfo = await queryOne('SELECT * FROM tokens WHERE address = ? AND is_memecoin = 1', [tokenAddress]);
      if (tokenInfo) {
        tokens = [tokenInfo];
      } else {
        throw new Error(`Token not found: ${tokenAddress}`);
      }
    } else {
      // Analyze recent tokens (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      tokens = await query(
        'SELECT * FROM tokens WHERE is_memecoin = 1 AND creation_date > ? ORDER BY creation_date DESC LIMIT 50', 
        [thirtyDaysAgo.toISOString()]
      );
    }
    
    if (tokens.length === 0) {
      throw new Error('No tokens found to analyze');
    }
    
    logger.info(`Analyzing meme correlations for ${tokens.length} tokens`);
    
    // Results storage
    const results = {
      tokens: {},
      trendingMemes: includeTrendingReport ? trendingMemes.slice(0, 10) : undefined,
      predictedOpportunities: []
    };
    
    // Process each token
    for (const token of tokens) {
      // Calculate correlations for this token
      const correlations = calculateMemeCorrelation(
        token.name,
        token.symbol,
        trendingMemes
      );
      
      // Save strong correlations to the database
      for (const correlation of correlations) {
        if (correlation.correlation >= 0.3) {
          await execute(
            `INSERT INTO meme_correlations
             (token_address, meme_name, correlation_score)
             VALUES (?, ?, ?)`,
            [
              token.address,
              correlation.meme,
              correlation.correlation
            ]
          );
        }
      }
      
      // Add to results
      results.tokens[token.address] = {
        name: token.name,
        symbol: token.symbol,
        correlations: correlations.slice(0, 5) // Top 5 correlations
      };
      
      // Check if this token has strong correlation with any trending meme
      const strongCorrelations = correlations.filter(c => c.correlation >= 0.6);
      
      if (strongCorrelations.length > 0) {
        // This token might be positioned to benefit from trending memes
        results.predictedOpportunities.push({
          tokenAddress: token.address,
          name: token.name,
          symbol: token.symbol,
          trendingMemeMatches: strongCorrelations
        });
      }
    }
    
    // Find potential "missing" memecoins (trending memes without matching coins)
    const allMemeNames = await query('SELECT DISTINCT meme_name FROM meme_correlations');
    const allMemeSet = new Set(allMemeNames.map(m => m.meme_name.toLowerCase()));
    
    const missingMemeOpportunities = trendingMemes
      .filter(meme => {
        // Check if this trending meme has no strongly correlated token
        const memeName = meme.name.toLowerCase();
        
        // If we don't have a token that correlates to this meme
        const hasExistingToken = allMemeSet.has(memeName);
        
        return !hasExistingToken;
      })
      .map(meme => ({
        memeName: meme.name,
        source: meme.source,
        potentialTokenThemes: generateTokenThemesFromMeme(meme.name)
      }))
      .slice(0, 5); // Top 5 opportunities
    
    results.missingMemeOpportunities = missingMemeOpportunities;
    
    logger.info(`Meme correlation analysis complete. Found ${Object.keys(results.tokens).length} token correlations and ${results.predictedOpportunities.length} potential opportunities`);
    
    return results;
  } catch (error) {
    logger.error(`Error in analyzeMemeCorrelation: ${error.message}`);
    throw new Error(`Failed to analyze meme correlation: ${error.message}`);
  }
}

/**
 * Generate potential token themes/names from a meme
 * @param {string} memeName - Name of the meme
 * @returns {Array<string>} - Potential token themes
 */
function generateTokenThemesFromMeme(memeName) {
  const themes = [];
  const memeWords = memeName.split(/\W+/).filter(Boolean);
  
  // Basic transformations
  themes.push(`${memeName} Coin`);
  themes.push(`${memeName} Token`);
  
  // If multiple words, create acronym
  if (memeWords.length > 1) {
    const acronym = memeWords.map(word => word[0].toUpperCase()).join('');
    themes.push(acronym);
  }
  
  // Take first word if multiple
  if (memeWords.length > 0) {
    themes.push(`${memeWords[0].toUpperCase()} Coin`);
  }
  
  return themes;
}

// MCP function metadata
const description = "Analyze correlation between memecoin tokens and current trending memes";
const parameters = {
  type: "object",
  properties: {
    tokenAddress: {
      type: "string",
      description: "Optional: Specific token address to analyze. If not provided, analyzes all recently tracked memecoins."
    },
    includeTrendingReport: {
      type: "boolean",
      description: "Whether to include a full report of trending memes in the response",
      default: true
    }
  }
};

module.exports = {
  handler,
  description,
  parameters
};
