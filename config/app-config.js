/**
 * Memecoin Observatory MCP Server Configuration
 */

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins: ['*'], // CORS configuration
  },
  
  // Solana configuration
  solana: {
    mainnetUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    devnetUrl: process.env.SOLANA_DEVNET_URL || 'https://api.devnet.solana.com',
    commitment: 'confirmed',
  },
  
  // Twitter API configuration
  twitter: {
    enabled: Boolean(
      process.env.TWITTER_API_KEY && 
      process.env.TWITTER_API_SECRET && 
      process.env.TWITTER_ACCESS_TOKEN && 
      process.env.TWITTER_ACCESS_SECRET
    ),
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },
  
  // Database configuration
  database: {
    path: process.env.DB_PATH || './data/memecoin_observatory.db',
  },
  
  // MCP schema configuration
  mcp: {
    schemaVersion: 'v1',
    name: 'Memecoin Observatory',
    description: 'A comprehensive toolkit for analyzing Solana memecoins, tracking trends, and providing AI-powered insights',
    version: '1.0.0',
    baseUrl: '/mcp',
    executeUrl: '/mcp/execute',
  },
  
  // Scheduled task configuration
  scheduledTasks: {
    // Run token discovery every 30 minutes
    tokenDiscovery: {
      enabled: true,
      schedule: '*/30 * * * *', // cron format: every 30 minutes
      limit: 100,
    },
    
    // Update social signals every hour
    socialUpdate: {
      enabled: true,
      schedule: '0 * * * *', // cron format: every hour
      limit: 50,
    },
    
    // Update meme correlations every 6 hours
    memeCorrelation: {
      enabled: true,
      schedule: '0 */6 * * *', // cron format: every 6 hours
    },
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: './logs',
  },
};
