/**
 * Test script for Memecoin Observatory MCP functions
 * 
 * This script will run the main functions to verify they're working correctly
 */

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const MCP_URL = `${BASE_URL}/mcp`;
const EXECUTE_URL = `${BASE_URL}/mcp/execute`;

// Example Solana token addresses (these are real Solana tokens)
const exampleTokens = {
  // Bonk - popular Solana memecoin
  bonk: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  // Dogwifhat - another popular Solana memecoin
  wif: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
};

async function testMcpEndpoints() {
  console.log('Testing Memecoin Observatory MCP endpoints...\n');
  
  try {
    // Test 1: Check MCP schema endpoint
    console.log('Test 1: Getting MCP schema...');
    const schemaResponse = await axios.get(MCP_URL);
    
    console.log(`✅ Schema received with ${schemaResponse.data.functions.length} functions:`);
    schemaResponse.data.functions.forEach(fn => {
      console.log(`  - ${fn.name}: ${fn.description}`);
    });
    console.log();
    
    // Test 2: Try running a rugpull scan on a known token
    console.log('Test 2: Running rugpull scan on BONK token...');
    console.log('This will test database connectivity and Solana API access...');
    
    try {
      console.log(`Sending request to: ${EXECUTE_URL}`);
      const rugpullResult = await axios.post(EXECUTE_URL, {
        name: "runRugpullScan",
        parameters: {
          tokenAddress: exampleTokens.bonk
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Rugpull scan complete for ${rugpullResult.data.result.name} (${rugpullResult.data.result.symbol})`);
      console.log(`  - Risk Level: ${rugpullResult.data.result.riskLevel}`);
      console.log(`  - Safety Score: ${rugpullResult.data.result.safetyScore}`);
      console.log(`  - Warnings: ${rugpullResult.data.result.warnings.length}`);
      console.log();
    } catch (error) {
      console.log('❌ Rugpull scan failed. Possible database or Solana API issues.');
      if (error.response) {
        console.log(`  Error: ${error.response.data.error}`);
      } else {
        console.log(`  Error: ${error.message}`);
      }
      console.log();
    }
    
    // Test 3: Try scanning for new memecoins
    console.log('Test 3: Scanning for new memecoins...');
    console.log('This will test Solana blockchain interaction...');
    
    try {
      const scanResult = await axios.post(EXECUTE_URL, {
        name: "scanNewMemecoins",
        parameters: {
          limit: 10
        }
      });
      
      console.log(`✅ Memecoin scan complete. Scanned ${scanResult.data.result.scannedTransactions} transactions.`);
      console.log(`  - Found ${scanResult.data.result.newMemecoinsFound} new memecoins.`);
      console.log();
    } catch (error) {
      console.log('❌ Memecoin scan failed. Possible Solana API issues.');
      if (error.response) {
        console.log(`  Error: ${error.response.data.error}`);
      } else {
        console.log(`  Error: ${error.message}`);
      }
      console.log();
    }
    
    // Test 4: Try generating a portfolio strategy
    console.log('Test 4: Generating a portfolio strategy...');
    console.log('This tests the portfolio recommendation engine...');
    
    try {
      const portfolioResult = await axios.post(EXECUTE_URL, {
        name: "getPortfolioStrategy",
        parameters: {
          riskTolerance: "moderate",
          investmentSize: 1000
        }
      });
      
      console.log(`✅ Portfolio strategy generated successfully.`);
      console.log(`  - Risk Tolerance: ${portfolioResult.data.result.riskTolerance}`);
      console.log(`  - Investment Size: $${portfolioResult.data.result.investmentSize}`);
      console.log(`  - Recommendations: ${portfolioResult.data.result.portfolio.recommendations.length} tokens`);
      console.log();
    } catch (error) {
      console.log('❌ Portfolio strategy generation failed.');
      if (error.response) {
        console.log(`  Error: ${error.response.data.error}`);
      } else {
        console.log(`  Error: ${error.message}`);
      }
      console.log();
    }
    
    console.log('Testing complete!');
    console.log('Note: Some functions may fail if you don\'t have Solana RPC URL or API keys set up.');
    console.log('Check the logs for more detailed error information.');
    
  } catch (error) {
    console.error('Error testing MCP endpoints:', error.message);
    console.log('Make sure the server is running on the correct port.');
  }
}

// Automatically run when executed directly
if (require.main === module) {
  testMcpEndpoints();
}

module.exports = { testMcpEndpoints };
