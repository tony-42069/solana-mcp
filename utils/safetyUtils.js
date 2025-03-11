const axios = require('axios');
const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getMint } = require('@solana/spl-token');

/**
 * Analyze a token contract for potential security issues
 * @param {Connection} connection - Solana connection
 * @param {string} tokenAddress - Token mint address
 * @returns {Promise<Object>} - Safety analysis results
 */
async function analyzeTokenSafety(connection, tokenAddress) {
  try {
    const mintPublicKey = new PublicKey(tokenAddress);
    const mintInfo = await getMint(connection, mintPublicKey);
    
    // Check if mint authority exists (can create more tokens)
    const mintAuthorityExists = mintInfo.mintAuthority !== null;
    
    // Check if freeze authority exists (can freeze token accounts)
    const freezeAuthorityExists = mintInfo.freezeAuthority !== null;
    
    // Get program accounts for this token
    const programAccounts = await connection.getProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
        filters: [
          {
            dataSize: 165, // Size of token account data
          },
          {
            memcmp: {
              offset: 0,
              bytes: mintPublicKey.toBase58(),
            },
          },
        ],
      }
    );
    
    // Analyze holder distribution
    let totalSupply = Number(mintInfo.supply);
    let holderCount = programAccounts.length;
    let topHolderPercentage = 0;
    
    if (programAccounts.length > 0 && totalSupply > 0) {
      // Sort accounts by balance
      const accounts = programAccounts.map(account => {
        // Extract balance from account data
        const data = Buffer.from(account.account.data);
        // Token balance is stored at offset 64, 8 bytes
        const balance = data.readBigUInt64LE(64);
        return {
          pubkey: account.pubkey.toBase58(),
          balance: Number(balance)
        };
      }).sort((a, b) => b.balance - a.balance);
      
      // Calculate top holder percentage
      if (accounts.length > 0) {
        topHolderPercentage = (accounts[0].balance / totalSupply) * 100;
      }
    }
    
    // Check for liquidity on DEX
    const hasLiquidity = await checkTokenLiquidity(tokenAddress);
    
    // Combine all safety metrics
    const safetyScore = calculateSafetyScore({
      mintAuthorityExists,
      freezeAuthorityExists,
      topHolderPercentage,
      holderCount,
      hasLiquidity
    });
    
    return {
      tokenAddress,
      safetyScore,
      details: {
        mintAuthorityExists,
        freezeAuthorityExists,
        topHolderPercentage,
        holderCount,
        hasLiquidity,
        supplySize: totalSupply / Math.pow(10, mintInfo.decimals)
      },
      warnings: generateWarnings({
        mintAuthorityExists,
        freezeAuthorityExists,
        topHolderPercentage,
        holderCount,
        hasLiquidity
      })
    };
  } catch (error) {
    console.error('Error analyzing token safety:', error.message);
    return {
      tokenAddress,
      safetyScore: 0,
      details: {
        mintAuthorityExists: true,
        freezeAuthorityExists: true,
        topHolderPercentage: 100,
        holderCount: 0,
        hasLiquidity: false,
        supplySize: 0
      },
      warnings: ['Unable to analyze token safety']
    };
  }
}

/**
 * Check if a token has liquidity on major DEXs
 * @param {string} tokenAddress - Token mint address
 * @returns {Promise<boolean>} - Whether the token has liquidity
 */
async function checkTokenLiquidity(tokenAddress) {
  try {
    // Check for liquidity on Jupiter (which aggregates many Solana DEXs)
    const response = await axios.get(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
    
    if (
      response.data && 
      response.data.data && 
      response.data.data[tokenAddress] &&
      response.data.data[tokenAddress].price > 0
    ) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking token liquidity:', error.message);
    return false;
  }
}

/**
 * Calculate a safety score based on various metrics
 * @param {Object} metrics - Token safety metrics
 * @returns {number} - Safety score from 0-100
 */
function calculateSafetyScore(metrics) {
  let score = 100;
  
  // Deduct points for mint authority (can create more tokens)
  if (metrics.mintAuthorityExists) {
    score -= 20;
  }
  
  // Deduct points for freeze authority (can freeze token accounts)
  if (metrics.freezeAuthorityExists) {
    score -= 10;
  }
  
  // Deduct points for high concentration of tokens in top holder
  if (metrics.topHolderPercentage > 50) {
    score -= Math.min(40, metrics.topHolderPercentage - 50);
  }
  
  // Deduct points for low holder count
  if (metrics.holderCount < 100) {
    score -= Math.min(20, (100 - metrics.holderCount) / 5);
  }
  
  // Deduct points for no liquidity
  if (!metrics.hasLiquidity) {
    score -= 30;
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate human-readable warnings based on safety metrics
 * @param {Object} metrics - Token safety metrics
 * @returns {Array<string>} - Array of warning messages
 */
function generateWarnings(metrics) {
  const warnings = [];
  
  if (metrics.mintAuthorityExists) {
    warnings.push('The token has an active mint authority, which means more tokens can be created.');
  }
  
  if (metrics.freezeAuthorityExists) {
    warnings.push('The token has an active freeze authority, which allows freezing token accounts.');
  }
  
  if (metrics.topHolderPercentage > 50) {
    warnings.push(`The top holder owns ${metrics.topHolderPercentage.toFixed(2)}% of the supply, creating concentration risk.`);
  }
  
  if (metrics.holderCount < 50) {
    warnings.push(`The token has only ${metrics.holderCount} holders, indicating low distribution.`);
  }
  
  if (!metrics.hasLiquidity) {
    warnings.push('The token has no detectable liquidity on major DEXs, making it difficult to trade.');
  }
  
  return warnings;
}

/**
 * Check if a token contract has similarities to known scams
 * @param {string} tokenAddress - Token mint address
 * @returns {Promise<Object>} - Scam similarity analysis
 */
async function checkScamSimilarity(tokenAddress) {
  // In a real implementation, this would compare against a database of known scams
  // For this example, we'll return a mock result
  const scamPatterns = {
    highMintAuthority: false,
    suspiciousHolderPattern: false,
    recentRugPullSimilarity: false
  };
  
  return {
    tokenAddress,
    scamScore: Object.values(scamPatterns).filter(Boolean).length * 33,
    scamPatterns
  };
}

module.exports = {
  analyzeTokenSafety,
  checkTokenLiquidity,
  checkScamSimilarity
};