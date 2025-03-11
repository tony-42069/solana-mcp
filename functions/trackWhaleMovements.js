const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAccount } = require('@solana/spl-token');
const { isWhaleAccount } = require('../utils/tokenUtils');
const { execute, query } = require('../utils/database');

/**
 * Track whale wallet movements for a specific memecoin or across all memecoins
 */
async function handler({ mainnetConnection, logger, parameters }) {
  const { tokenAddress, limit, minAmount } = parameters;
  
  const actualLimit = limit || 10;
  const actualMinAmount = minAmount || 1000; // Minimum token amount to track
  
  try {
    logger.info(`Tracking whale movements ${tokenAddress ? `for token: ${tokenAddress}` : 'across all memecoins'}`);
    
    // List of tokens to track
    let tokens = [];
    
    if (tokenAddress) {
      // Just track the specified token
      const tokenInfo = await query('SELECT * FROM tokens WHERE address = ? AND is_memecoin = 1', [tokenAddress]);
      tokens = tokenInfo;
    } else {
      // Track all tokens in our database, limited to most recent ones
      tokens = await query('SELECT * FROM tokens WHERE is_memecoin = 1 ORDER BY creation_date DESC LIMIT 50');
    }
    
    if (tokens.length === 0) {
      throw new Error('No tokens found to track');
    }
    
    logger.info(`Found ${tokens.length} tokens to track`);
    
    // Track movements for each token
    const allMovements = [];
    
    for (const token of tokens) {
      try {
        // Get recent transactions for this token's mint
        const mintAddress = new PublicKey(token.address);
        const signatures = await mainnetConnection.getSignaturesForAddress(
          mintAddress,
          { limit: 50 }
        );
        
        logger.info(`Found ${signatures.length} recent transactions for ${token.symbol} (${token.address})`);
        
        // Process each transaction
        for (const sig of signatures) {
          try {
            const tx = await mainnetConnection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed'
            });
            
            if (!tx || !tx.meta || !tx.meta.postTokenBalances || !tx.meta.preTokenBalances) {
              continue;
            }
            
            // Look for token transfers
            const tokenTransfers = [];
            
            // Compare pre and post balances to find transfers
            for (const postBalance of tx.meta.postTokenBalances) {
              if (postBalance.mint === token.address) {
                const preBalance = tx.meta.preTokenBalances.find(
                  pre => pre.accountIndex === postBalance.accountIndex
                );
                
                if (preBalance) {
                  const balanceDiff = 
                    (postBalance.uiTokenAmount.uiAmount || 0) - 
                    (preBalance.uiTokenAmount.uiAmount || 0);
                  
                  // If balance changed significantly
                  if (Math.abs(balanceDiff) >= actualMinAmount) {
                    // Get the owner of this token account
                    const accountKey = tx.transaction.message.accountKeys[postBalance.accountIndex];
                    
                    if (accountKey) {
                      const isWhale = await isWhaleAccount(mainnetConnection, accountKey.pubkey.toBase58());
                      
                      // Only include if it's a whale account
                      if (isWhale) {
                        tokenTransfers.push({
                          tokenAddress: token.address,
                          tokenSymbol: token.symbol,
                          tokenName: token.name,
                          whaleAddress: accountKey.pubkey.toBase58(),
                          transactionHash: sig.signature,
                          blockTime: tx.blockTime,
                          slot: tx.slot,
                          balanceChange: balanceDiff,
                          balanceChangeUSD: 0 // Would require price data
                        });
                      }
                    }
                  }
                }
              }
            }
            
            // Add any found transfers to our results
            if (tokenTransfers.length > 0) {
              for (const transfer of tokenTransfers) {
                // Save to database
                await execute(
                  `INSERT INTO whale_movements
                   (token_address, wallet_address, transaction_signature, 
                    amount, direction)
                   VALUES (?, ?, ?, ?, ?)`,
                  [
                    transfer.tokenAddress,
                    transfer.whaleAddress,
                    transfer.transactionHash,
                    Math.abs(transfer.balanceChange),
                    transfer.balanceChange > 0 ? 'buy' : 'sell'
                  ]
                );
                
                allMovements.push(transfer);
              }
            }
          } catch (txError) {
            logger.error(`Error processing transaction ${sig.signature}: ${txError.message}`);
          }
        }
      } catch (tokenError) {
        logger.error(`Error tracking movements for token ${token.address}: ${tokenError.message}`);
      }
    }
    
    // Sort by block time (most recent first) and limit results
    allMovements.sort((a, b) => b.blockTime - a.blockTime);
    const limitedMovements = allMovements.slice(0, actualLimit);
    
    logger.info(`Found ${allMovements.length} whale movements, returning ${limitedMovements.length}`);
    
    return {
      movements: limitedMovements,
      totalFound: allMovements.length,
      trackingPeriod: "Last 24 hours" // This would depend on actual implementation
    };
  } catch (error) {
    logger.error(`Error in trackWhaleMovements: ${error.message}`);
    throw new Error(`Failed to track whale movements: ${error.message}`);
  }
}

// MCP function metadata
const description = "Track whale wallet movements for Solana memecoins";
const parameters = {
  type: "object",
  properties: {
    tokenAddress: {
      type: "string",
      description: "Optional: Specific token address to track. If not provided, tracks across all tracked memecoins."
    },
    limit: {
      type: "number",
      description: "Maximum number of movements to return",
      default: 10
    },
    minAmount: {
      type: "number",
      description: "Minimum token amount to consider as a significant movement",
      default: 1000
    }
  }
};

module.exports = {
  handler,
  description,
  parameters
};
