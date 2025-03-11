const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database connection
let db = null;

/**
 * Initialize the database with required tables
 * @returns {Promise} Promise that resolves when database is initialized
 */
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DB_PATH || './data/memecoin_observatory.db';
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        return reject(new Error(`Error opening database: ${err.message}`));
      }
      
      console.log(`Connected to SQLite database at ${dbPath}`);
      
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          return reject(new Error(`Error enabling foreign keys: ${err.message}`));
        }
        
        // Create tables
        createTables()
          .then(resolve)
          .catch(reject);
      });
    });
  });
}

/**
 * Create all required tables
 * @returns {Promise} Promise that resolves when tables are created
 */
async function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tokens table
      db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
          address TEXT PRIMARY KEY,
          name TEXT,
          symbol TEXT,
          supply REAL,
          decimals INTEGER,
          mint_authority TEXT,
          freeze_authority TEXT,
          holder_count INTEGER,
          creation_date TEXT,
          is_memecoin BOOLEAN,
          discovery_date TEXT DEFAULT CURRENT_TIMESTAMP,
          last_updated TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Token metrics table
      db.run(`
        CREATE TABLE IF NOT EXISTS token_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_address TEXT,
          price REAL,
          volume_24h REAL,
          liquidity REAL,
          market_cap REAL,
          price_change_24h REAL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (token_address) REFERENCES tokens(address)
        )
      `);
      
      // Social signals table
      db.run(`
        CREATE TABLE IF NOT EXISTS social_signals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_address TEXT,
          platform TEXT,
          mentions INTEGER,
          sentiment_score REAL,
          engagement_score REAL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (token_address) REFERENCES tokens(address)
        )
      `);
      
      // Whale movements table
      db.run(`
        CREATE TABLE IF NOT EXISTS whale_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_address TEXT,
          wallet_address TEXT,
          transaction_signature TEXT,
          amount REAL,
          direction TEXT,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (token_address) REFERENCES tokens(address)
        )
      `);
      
      // Meme correlations table
      db.run(`
        CREATE TABLE IF NOT EXISTS meme_correlations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_address TEXT,
          meme_name TEXT,
          correlation_score REAL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (token_address) REFERENCES tokens(address)
        )
      `);
      
      // Safety scores table
      db.run(`
        CREATE TABLE IF NOT EXISTS safety_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_address TEXT,
          contract_score REAL,
          rugpull_risk_score REAL,
          holder_distribution_score REAL,
          liquidity_score REAL,
          overall_safety_score REAL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (token_address) REFERENCES tokens(address)
        )
      `, (err) => {
        if (err) {
          return reject(new Error(`Error creating tables: ${err.message}`));
        }
        resolve();
      });
    });
  });
}

/**
 * Get the database instance
 * @returns {Object} SQLite database instance
 */
function getDatabase() {
  return db;
}

/**
 * Run a parameterized query and get all results
 * @param {string} sql - SQL query to run
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Array>} - Promise resolving to query results
 */
async function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

/**
 * Run a parameterized query and get the first result
 * @param {string} sql - SQL query to run
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Object>} - Promise resolving to first row
 */
async function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

/**
 * Execute a parameterized query
 * @param {string} sql - SQL query to run
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Object>} - Promise resolving to result
 */
async function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        return reject(err);
      }
      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

/**
 * Insert a token into the database
 * @param {Object} token - Token data to insert
 * @returns {Promise<Object>} - Promise resolving to result
 */
async function insertToken(token) {
  const sql = `
    INSERT OR REPLACE INTO tokens (
      address, name, symbol, supply, decimals, 
      mint_authority, freeze_authority, holder_count, 
      is_memecoin, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;
  
  const params = [
    token.address,
    token.name,
    token.symbol,
    token.supply,
    token.decimals,
    token.mintAuthority,
    token.freezeAuthority,
    token.holderCount,
    token.isMemetoken ? 1 : 0
  ];
  
  return execute(sql, params);
}

/**
 * Insert token metrics into the database
 * @param {string} tokenAddress - Token address
 * @param {Object} metrics - Token metrics data
 * @returns {Promise<Object>} - Promise resolving to result
 */
async function insertTokenMetrics(tokenAddress, metrics) {
  const sql = `
    INSERT INTO token_metrics (
      token_address, price, volume_24h, liquidity, 
      market_cap, price_change_24h
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    tokenAddress,
    metrics.price,
    metrics.volume24h,
    metrics.liquidity,
    metrics.marketCap,
    metrics.priceChange24h
  ];
  
  return execute(sql, params);
}

/**
 * Insert social signal data into the database
 * @param {string} tokenAddress - Token address
 * @param {Object} signal - Social signal data
 * @returns {Promise<Object>} - Promise resolving to result
 */
async function insertSocialSignal(tokenAddress, signal) {
  const sql = `
    INSERT INTO social_signals (
      token_address, platform, mentions, 
      sentiment_score, engagement_score
    ) VALUES (?, ?, ?, ?, ?)
  `;
  
  const params = [
    tokenAddress,
    signal.platform,
    signal.mentions,
    signal.sentimentScore,
    signal.engagementScore
  ];
  
  return execute(sql, params);
}

/**
 * Insert whale movement data into the database
 * @param {string} tokenAddress - Token address
 * @param {Object} movement - Whale movement data
 * @returns {Promise<Object>} - Promise resolving to result
 */
async function insertWhaleMovement(tokenAddress, movement) {
  const sql = `
    INSERT INTO whale_movements (
      token_address, wallet_address, transaction_signature,
      amount, direction
    ) VALUES (?, ?, ?, ?, ?)
  `;
  
  const params = [
    tokenAddress,
    movement.walletAddress,
    movement.transactionSignature,
    movement.amount,
    movement.direction
  ];
  
  return execute(sql, params);
}

/**
 * Insert meme correlation data into the database
 * @param {string} tokenAddress - Token address
 * @param {Object} correlation - Meme correlation data
 * @returns {Promise<Object>} - Promise resolving to result
 */
async function insertMemeCorrelation(tokenAddress, correlation) {
  const sql = `
    INSERT INTO meme_correlations (
      token_address, meme_name, correlation_score
    ) VALUES (?, ?, ?)
  `;
  
  const params = [
    tokenAddress,
    correlation.memeName,
    correlation.correlationScore
  ];
  
  return execute(sql, params);
}

/**
 * Insert safety score data into the database
 * @param {string} tokenAddress - Token address
 * @param {Object} scores - Safety score data
 * @returns {Promise<Object>} - Promise resolving to result
 */
async function insertSafetyScore(tokenAddress, scores) {
  const sql = `
    INSERT INTO safety_scores (
      token_address, contract_score, rugpull_risk_score,
      holder_distribution_score, liquidity_score, overall_safety_score
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    tokenAddress,
    scores.contractScore,
    scores.rugpullRiskScore,
    scores.holderDistributionScore,
    scores.liquidityScore,
    scores.overallSafetyScore
  ];
  
  return execute(sql, params);
}

/**
 * Get all memecoins from the database
 * @param {number} limit - Maximum number of tokens to return
 * @returns {Promise<Array>} - Promise resolving to tokens
 */
async function getMemecoins(limit = 100) {
  const sql = `
    SELECT * FROM tokens
    WHERE is_memecoin = 1
    ORDER BY discovery_date DESC
    LIMIT ?
  `;
  
  return query(sql, [limit]);
}

/**
 * Get a token by address
 * @param {string} address - Token address
 * @returns {Promise<Object>} - Promise resolving to token
 */
async function getTokenByAddress(address) {
  const sql = `
    SELECT * FROM tokens
    WHERE address = ?
  `;
  
  return queryOne(sql, [address]);
}

/**
 * Get token metrics for a token
 * @param {string} address - Token address
 * @returns {Promise<Object>} - Promise resolving to metrics
 */
async function getTokenMetrics(address) {
  const sql = `
    SELECT * FROM token_metrics
    WHERE token_address = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `;
  
  return queryOne(sql, [address]);
}

/**
 * Get social signals for a token
 * @param {string} address - Token address
 * @returns {Promise<Array>} - Promise resolving to social signals
 */
async function getSocialSignals(address) {
  const sql = `
    SELECT * FROM social_signals
    WHERE token_address = ?
    ORDER BY timestamp DESC
  `;
  
  return query(sql, [address]);
}

/**
 * Get whale movements for a token
 * @param {string} address - Token address
 * @param {number} limit - Maximum number of movements to return
 * @returns {Promise<Array>} - Promise resolving to whale movements
 */
async function getWhaleMovements(address, limit = 10) {
  const sql = `
    SELECT * FROM whale_movements
    WHERE token_address = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `;
  
  return query(sql, [address, limit]);
}

/**
 * Get meme correlations for a token
 * @param {string} address - Token address
 * @returns {Promise<Array>} - Promise resolving to meme correlations
 */
async function getMemeCorrelations(address) {
  const sql = `
    SELECT * FROM meme_correlations
    WHERE token_address = ?
    ORDER BY correlation_score DESC
  `;
  
  return query(sql, [address]);
}

/**
 * Get safety score for a token
 * @param {string} address - Token address
 * @returns {Promise<Object>} - Promise resolving to safety score
 */
async function getSafetyScore(address) {
  const sql = `
    SELECT * FROM safety_scores
    WHERE token_address = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `;
  
  return queryOne(sql, [address]);
}

module.exports = {
  initializeDatabase,
  getDatabase,
  query,
  queryOne,
  execute,
  insertToken,
  insertTokenMetrics,
  insertSocialSignal,
  insertWhaleMovement,
  insertMemeCorrelation,
  insertSafetyScore,
  getMemecoins,
  getTokenByAddress,
  getTokenMetrics,
  getSocialSignals,
  getWhaleMovements,
  getMemeCorrelations,
  getSafetyScore
};
