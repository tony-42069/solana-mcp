const { analyzeTokenSafety, checkScamSimilarity } = require('../utils/safetyUtils');
const { execute, queryOne } = require('../utils/database');

/**
 * Run safety analysis and rugpull risk scan for a memecoin
 */
async function handler({ mainnetConnection, logger, parameters }) {
  const { tokenAddress } = parameters;
  
  if (!tokenAddress) {
    throw new Error('Token address is required');
  }
  
  try {
    logger.info(`Running rugpull scan for token: ${tokenAddress}`);
    
    // Get token info from our database
    const tokenInfo = await queryOne('SELECT * FROM tokens WHERE address = ? AND is_memecoin = 1', [tokenAddress]);
    
    if (!tokenInfo) {
      throw new Error(`Token not found: ${tokenAddress}`);
    }
    
    // Analyze token safety on-chain
    const safetyAnalysis = await analyzeTokenSafety(mainnetConnection, tokenAddress);
    
    // Check for similarity to known scams
    const scamSimilarity = await checkScamSimilarity(tokenAddress);
    
    // Combined safety score (weighted average)
    const safetyScore = (safetyAnalysis.safetyScore * 0.7) + (100 - scamSimilarity.scamScore) * 0.3;
    
    // Generate risk level
    let riskLevel;
    if (safetyScore >= 80) {
      riskLevel = "Low";
    } else if (safetyScore >= 50) {
      riskLevel = "Medium";
    } else if (safetyScore >= 20) {
      riskLevel = "High";
    } else {
      riskLevel = "Extreme";
    }
    
    // Save safety score to database
    await execute(
      `INSERT INTO safety_scores
       (token_address, contract_score, rugpull_risk_score, holder_distribution_score, 
        liquidity_score, overall_safety_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tokenAddress,
        safetyAnalysis.details.mintAuthorityExists ? 50 : 90, // Contract score
        scamSimilarity.scamScore,                           // Rugpull risk score
        100 - safetyAnalysis.details.topHolderPercentage,   // Holder distribution score
        safetyAnalysis.details.hasLiquidity ? 80 : 20,      // Liquidity score
        Math.round(safetyScore)                             // Overall safety score
      ]
    );
    
    // Generate comprehensive report
    const result = {
      tokenAddress,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      safetyScore: Math.round(safetyScore),
      riskLevel,
      analysis: {
        onChainMetrics: {
          mintAuthorityActive: safetyAnalysis.details.mintAuthorityExists,
          freezeAuthorityActive: safetyAnalysis.details.freezeAuthorityExists,
          topHolderPercentage: safetyAnalysis.details.topHolderPercentage,
          holderCount: safetyAnalysis.details.holderCount,
          supplySize: safetyAnalysis.details.supplySize,
          hasLiquidity: safetyAnalysis.details.hasLiquidity
        },
        scamSimilarity: {
          similarityScore: scamSimilarity.scamScore,
          patterns: scamSimilarity.scamPatterns
        }
      },
      warnings: [
        ...safetyAnalysis.warnings,
        ...(scamSimilarity.scamScore > 30 ? ["This token has some similarities to previously identified scam tokens."] : [])
      ],
      recommendations: generateRecommendations(safetyScore, safetyAnalysis, scamSimilarity)
    };
    
    logger.info(`Rugpull scan complete for ${tokenInfo.name}: Score ${Math.round(safetyScore)}, Risk ${riskLevel}`);
    
    return result;
  } catch (error) {
    logger.error(`Error in runRugpullScan: ${error.message}`);
    throw new Error(`Failed to run rugpull scan: ${error.message}`);
  }
}

/**
 * Generate safety recommendations based on scan results
 * @param {number} safetyScore - Overall safety score
 * @param {Object} safetyAnalysis - Token safety analysis
 * @param {Object} scamSimilarity - Scam similarity analysis
 * @returns {Array<string>} - Safety recommendations
 */
function generateRecommendations(safetyScore, safetyAnalysis, scamSimilarity) {
  const recommendations = [];
  
  // General recommendation based on safety score
  if (safetyScore < 20) {
    recommendations.push("EXTREME CAUTION: This token exhibits multiple high-risk characteristics. Not recommended for investment.");
  } else if (safetyScore < 50) {
    recommendations.push("HIGH RISK: This token shows several concerning patterns. Proceed with significant caution if considering investment.");
  } else if (safetyScore < 80) {
    recommendations.push("MODERATE RISK: This token has some risk factors to be aware of. Practice caution and only invest what you can afford to lose.");
  } else {
    recommendations.push("LOWER RISK: This token appears to have fewer risk factors than many memecoins, but all memecoins carry inherent risks.");
  }
  
  // Specific recommendations based on findings
  if (safetyAnalysis.details.mintAuthorityExists) {
    recommendations.push("The token has an active mint authority, meaning more tokens can be created at any time. This could lead to value dilution.");
  }
  
  if (safetyAnalysis.details.topHolderPercentage > 50) {
    recommendations.push(`A single holder owns ${safetyAnalysis.details.topHolderPercentage.toFixed(2)}% of the supply, creating high concentration risk and potential for price manipulation.`);
  }
  
  if (!safetyAnalysis.details.hasLiquidity) {
    recommendations.push("The token lacks significant liquidity on major DEXs, which could make it difficult to exit positions.");
  }
  
  if (scamSimilarity.scamScore > 50) {
    recommendations.push("This token has significant similarities to tokens previously identified as scams or rugpulls.");
  }
  
  if (safetyAnalysis.details.holderCount < 50) {
    recommendations.push("The token has a small holder base, which often indicates a new or less established project.");
  }
  
  // Always add this
  recommendations.push("REMINDER: All memecoins are speculative investments with high volatility. Never invest more than you can afford to lose.");
  
  return recommendations;
}

// MCP function metadata
const description = "Analyze a memecoin for rugpull and scam risks";
const parameters = {
  type: "object",
  properties: {
    tokenAddress: {
      type: "string",
      description: "The Solana address of the memecoin token to analyze"
    }
  },
  required: ["tokenAddress"]
};

module.exports = {
  handler,
  description,
  parameters
};
