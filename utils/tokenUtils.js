const { 
    PublicKey, 
    Connection, 
    TokenAccountsFilter 
  } = require('@solana/web3.js');
  const { 
    TOKEN_PROGRAM_ID, 
    getAccount, 
    getMint 
  } = require('@solana/spl-token');
  const axios = require('axios');
  
  /**
   * Get token metadata from the Solana blockchain
   * @param {Connection} connection - Solana connection
   * @param {string} tokenAddress - Token mint address
   * @returns {Promise<Object>} - Token metadata
   */
  async function getTokenMetadata(connection, tokenAddress) {
    try {
      const tokenPublicKey = new PublicKey(tokenAddress);
      const mintInfo = await getMint(connection, tokenPublicKey);
      
      // Get token holder count (approximate)
      const tokenHolders = await connection.getTokenLargestAccounts(tokenPublicKey);
      
      // Attempt to get metadata from Jupiter/Token Lists/etc.
      let additionalInfo = {};
      try {
        const jupiterResponse = await axios.get(`https://station.jup.ag/api/token/${tokenAddress}`);
        if (jupiterResponse.data) {
          additionalInfo = {
            name: jupiterResponse.data.name,
            symbol: jupiterResponse.data.symbol,
            logoURI: jupiterResponse.data.logoURI,
            coingeckoId: jupiterResponse.data.coingeckoId,
            website: jupiterResponse.data.extensions?.website || null,
            twitter: jupiterResponse.data.extensions?.twitter || null
          };
        }
      } catch (error) {
        // Ignore errors, just use basic data
      }
  
      return {
        address: tokenAddress,
        supply: Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals),
        decimals: mintInfo.decimals,
        holderCount: tokenHolders?.value?.length || 0,
        mintAuthority: mintInfo.mintAuthority?.toBase58() || null,
        freezeAuthority: mintInfo.freezeAuthority?.toBase58() || null,
        isInitialized: mintInfo.isInitialized,
        ...additionalInfo
      };
    } catch (error) {
      throw new Error(`Failed to get token metadata: ${error.message}`);
    }
  }
  
  /**
   * Check if a token is likely a memecoin based on various signals
   * @param {Object} tokenInfo - Token information
   * @returns {boolean} - Whether the token is likely a memecoin
   */
  function isMemetoken(tokenInfo) {
    // Check token name and symbol for common meme-related terms
    const memeTerms = [
      'meme', 'doge', 'shib', 'inu', 'cat', 'elon', 'pepe', 'moon', 'safe', 
      'cum', 'chad', 'based', 'wojak', 'coin', 'rocket', 'lambo', 'tendies', 
      'wen', 'wojak', 'pepe', 'frog', 'moon', 'bored', 'ape', 'monkey', 'trump',
      'biden', 'pump', 'dump', 'fomo', 'goku', 'senpai', 'sama', 'waifu'
    ];
    
    // Convert token details to lowercase for case-insensitive matching
    const nameLC = (tokenInfo.name || '').toLowerCase();
    const symbolLC = (tokenInfo.symbol || '').toLowerCase();
    
    // Check for meme terms in name or symbol
    const hasMemeTerms = memeTerms.some(term => 
      nameLC.includes(term) || symbolLC.includes(term)
    );
    
    // Check for common patterns in memecoin symbols (all caps, short)
    const hasMemecoinSymbolPattern = symbolLC === symbolLC.toUpperCase() && 
      symbolLC.length <= 10 && symbolLC.length >= 2;
      
    // Check for large supply (memecoins often have large supplies)
    const hasLargeSupply = tokenInfo.supply > 1000000;
    
    // Final decision based on various signals
    return hasMemeTerms || 
      (hasMemecoinSymbolPattern && hasLargeSupply) || 
      (nameLC.includes('token') && hasLargeSupply);
  }
  
  /**
   * Get liquidity information for a token
   * @param {string} tokenAddress - Token mint address
   * @returns {Promise<Object>} - Liquidity info
   */
  async function getTokenLiquidity(tokenAddress) {
    try {
      // Try to get liquidity info from Jupiter API
      const response = await axios.get(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
      
      if (response.data && response.data.data && response.data.data[tokenAddress]) {
        const priceData = response.data.data[tokenAddress];
        return {
          price: priceData.price || 0,
          volume24h: priceData.volume24h || 0,
          liquidity: priceData.liquidity || 0,
          marketCap: priceData.market_cap || 0,
          priceChange24h: priceData.price_change_24h || 0
        };
      }
      
      return {
        price: 0,
        volume24h: 0,
        liquidity: 0,
        marketCap: 0,
        priceChange24h: 0
      };
    } catch (error) {
      console.error('Error getting token liquidity:', error.message);
      return {
        price: 0,
        volume24h: 0,
        liquidity: 0,
        marketCap: 0,
        priceChange24h: 0
      };
    }
  }
  
  /**
   * Check if an account is likely a whale (has large balance or frequent large trades)
   * @param {Connection} connection - Solana connection
   * @param {string} accountAddress - Account address to check
   * @returns {Promise<boolean>} - Whether the account is likely a whale
   */
  async function isWhaleAccount(connection, accountAddress) {
    try {
      const publicKey = new PublicKey(accountAddress);
      const balance = await connection.getBalance(publicKey);
      
      // Consider accounts with more than 10 SOL as potential whales
      const hasLargeSOLBalance = balance > 10 * 1e9;
      
      // Get recent transactions (simplified for example)
      const transactions = await connection.getConfirmedSignaturesForAddress2(
        publicKey, 
        { limit: 10 }
      );
      
      // If we have many transactions plus significant SOL, likely a whale
      return hasLargeSOLBalance && transactions.length > 5;
    } catch (error) {
      console.error('Error checking whale account:', error.message);
      return false;
    }
  }
  
  module.exports = {
    getTokenMetadata,
    isMemetoken,
    getTokenLiquidity,
    isWhaleAccount
  };
  