/**
 * Sample Data Initialization for Memecoin Observatory MCP
 * 
 * This script populates the database with sample tokens for testing
 */

const { initializeDatabase, insertToken, insertTokenMetrics, insertSafetyScore } = require('./utils/database');
const path = require('path');
const fs = require('fs');

// Example tokens to insert
const sampleTokens = [
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
    name: "Bonk",
    symbol: "BONK",
    supply: 499999975866476.1,
    decimals: 5,
    mintAuthority: null,
    freezeAuthority: null,
    holderCount: 15000,
    isMemetoken: true,
    createdAt: "2022-12-25T00:00:00.000Z"
  },
  {
    address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
    name: "dogwifhat",
    symbol: "WIF",
    supply: 998899915666.9,
    decimals: 6,
    mintAuthority: null,
    freezeAuthority: null,
    holderCount: 12000,
    isMemetoken: true,
    createdAt: "2023-12-12T00:00:00.000Z"
  }
];

// Sample token metrics
const sampleMetrics = [
  {
    tokenAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
    price: 0.00001912,
    volume24h: 15736210,
    liquidity: 38257390,
    marketCap: 9584999532,
    priceChange24h: -2.15
  },
  {
    tokenAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
    price: 0.7123,
    volume24h: 25498672,
    liquidity: 47123580,
    marketCap: 699999941,
    priceChange24h: 3.45
  }
];

// Sample safety scores
const safetySamples = [
  {
    tokenAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
    contractScore: 85,
    rugpullRiskScore: 15,
    holderDistributionScore: 75,
    liquidityScore: 90,
    overallSafetyScore: 82
  },
  {
    tokenAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
    contractScore: 80,
    rugpullRiskScore: 18,
    holderDistributionScore: 70,
    liquidityScore: 85,
    overallSafetyScore: 78
  }
];

// Initialize database and insert sample data
async function initializeSampleData() {
  console.log('Initializing database with sample data...');
  
  try {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
      console.log('Created data directory.');
    }
    
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized.');
    
    // Insert sample tokens
    for (const token of sampleTokens) {
      await insertToken({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        supply: token.supply,
        decimals: token.decimals,
        mintAuthority: token.mintAuthority,
        freezeAuthority: token.freezeAuthority,
        holderCount: token.holderCount,
        isMemetoken: token.isMemetoken
      });
      console.log(`Inserted token: ${token.name} (${token.symbol})`);
    }
    
    // Insert sample metrics
    for (const metrics of sampleMetrics) {
      await insertTokenMetrics(metrics.tokenAddress, metrics);
      console.log(`Inserted metrics for token: ${metrics.tokenAddress}`);
    }
    
    // Insert sample safety scores
    for (const safety of safetySamples) {
      await insertSafetyScore(safety.tokenAddress, safety);
      console.log(`Inserted safety score for token: ${safety.tokenAddress}`);
    }
    
    console.log('Sample data initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing sample data:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeSampleData();
