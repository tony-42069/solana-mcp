const { PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { getTokenMetadata, isMemetoken } = require('../utils/tokenUtils');
const { execute, query } = require('../utils/database');

/**
 * Scan for new memecoin tokens on Solana
 */
async function handler({ mainnetConnection, logger, parameters }) {
  const limit = parameters?.limit || 100;
  
  try {
    logger.info(`Scanning for new memecoins, limit: ${limit}`);
    
    // Get recent token accounts
    const recentSignatures = await mainnetConnection.getSignaturesForAddress(
      TOKEN_PROGRAM_ID,
      { limit }
    );
    
    logger.info(`Found ${recentSignatures.length} recent token program signatures`);
    
    // Track new tokens found
    const newTokens = [];
    const existingTokens = new Set();
    
    // Get existing tokens from our database
    const dbTokens = await query('SELECT address FROM tokens WHERE is_memecoin = 1');
    dbTokens.forEach(token => existingTokens.add(token.address));
    
    // Process each transaction to find token creations
    for (const sig of recentSignatures) {
      try {
        const tx = await mainnetConnection.getParsedTransaction(sig.signature);
        
        if (!tx || !tx.meta || !tx.meta.logMessages) {
          continue;
        }
        
        // Look for "create account" instructions related to tokens
        const createAccountLogs = tx.meta.logMessages.filter(
          log => log.includes('system_instruction: CreateAccount') || log.includes('create_account')
        );
        
        // If this might be a token creation transaction
        if (createAccountLogs.length > 0) {
          // Get all mint instructions in this transaction
          const initMintLogs = tx.meta.logMessages.filter(
            log => log.includes('invoke_signed') && log.includes('initialize_mint')
          );
          
          if (initMintLogs.length > 0) {
            // Find the token address from the instruction
            // This is simplified - in a production system, parse more carefully
            const relevantInstructions = tx.transaction.message.instructions.filter(
              ix => ix.programId && ix.programId.equals(TOKEN_PROGRAM_ID)
            );
            
            if (relevantInstructions.length > 0) {
              const tokenAddresses = [];
              
              // Try to extract token addresses from accounts in the instruction
              for (const instruction of tx.transaction.message.instructions) {
                if (instruction.accounts && instruction.accounts.length > 0) {
                  const potentialMintAccount = instruction.accounts[0];
                  const account = tx.transaction.message.accountKeys[potentialMintAccount];
                  if (account) {
                    tokenAddresses.push(account.pubkey.toBase58());
                  }
                }
              }
              
              // Filter for unique addresses
              const uniqueAddresses = [...new Set(tokenAddresses)];
              
              // Check each potential token address
              for (const address of uniqueAddresses) {
                // Skip if we already know about this token
                if (existingTokens.has(address)) {
                  continue;
                }
                
                try {
                  // Get token metadata
                  const metadata = await getTokenMetadata(mainnetConnection, address);
                  
                  // Check if it's a memecoin based on name, symbol, etc.
                  if (isMemetoken(metadata)) {
                    logger.info(`Found new potential memecoin: ${metadata.name} (${metadata.symbol})`);
                    
                    // Add to our list
                    newTokens.push({
                      address: metadata.address,
                      name: metadata.name || `Unknown (${metadata.address.slice(0, 6)}...)`,
                      symbol: metadata.symbol || 'UNKNOWN',
                      supply: metadata.supply,
                      decimals: metadata.decimals,
                      created_at: new Date(tx.blockTime * 1000).toISOString(),
                      created_block: tx.slot,
                      discovered_at: new Date().toISOString(),
                      last_updated: new Date().toISOString(),
                      logo_url: metadata.logoURI || null,
                      website_url: metadata.website || null,
                      twitter_url: metadata.twitter || null,
                      telegram_url: null,
                      discord_url: null
                    });
                    
                    // Add to our database
                    await execute(
                      `INSERT OR IGNORE INTO tokens 
                       (address, name, symbol, supply, decimals, creation_date, 
                        discovery_date, last_updated, is_memecoin) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                      [
                        metadata.address,
                        metadata.name || `Unknown (${metadata.address.slice(0, 6)}...)`,
                        metadata.symbol || 'UNKNOWN',
                        metadata.supply,
                        metadata.decimals,
                        new Date(tx.blockTime * 1000).toISOString(),
                        new Date().toISOString(),
                        new Date().toISOString()
                      ]
                    );
                    
                    // Add to tracking set
                    existingTokens.add(address);
                  }
                } catch (innerError) {
                  logger.error(`Error processing potential token ${address}: ${innerError.message}`);
                }
              }
            }
          }
        }
      } catch (txError) {
        logger.error(`Error processing transaction ${sig.signature}: ${txError.message}`);
      }
    }
    
    logger.info(`Scan complete. Found ${newTokens.length} new memecoins`);
    
    return {
      scannedTransactions: recentSignatures.length,
      newMemecoinsFound: newTokens.length,
      latestMemecoins: newTokens.slice(0, 10) // Return the 10 most recent
    };
  } catch (error) {
    logger.error(`Error in scanNewMemecoins: ${error.message}`);
    throw new Error(`Failed to scan for new memecoins: ${error.message}`);
  }
}

// MCP function metadata
const description = "Scan for newly created memecoin tokens on Solana";
const parameters = {
  type: "object",
  properties: {
    limit: {
      type: "number",
      description: "Maximum number of recent transactions to scan",
      default: 100
    }
  }
};

module.exports = {
  handler,
  description,
  parameters
};
