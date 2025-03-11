/**
 * Startup script for Memecoin Observatory MCP Server
 * 
 * This script helps with starting the MCP server and handling common issues.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Log with timestamps
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

// Check if .env file exists
function checkEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    log('❌ No .env file found. Creating a template...');
    
    const envTemplate = `# Server configuration
PORT=3000
NODE_ENV=development

# Solana configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_DEVNET_URL=https://api.devnet.solana.com

# Twitter API (if you have access)
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=

# Database configuration
DB_PATH=./data/memecoin_observatory.db

# Logging
LOG_LEVEL=info
`;
    
    fs.writeFileSync(envPath, envTemplate);
    log('✅ Created template .env file. Please edit it with your RPC URL and Twitter credentials if available.');
    return false;
  }
  
  log('✅ Found .env file.');
  return true;
}

// Check dependencies
function checkDependencies() {
  log('Checking dependencies...');
  
  try {
    // Check for node_modules directory
    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
      log('❌ node_modules directory not found. Running npm install...');
      
      try {
        execSync('npm install', { stdio: 'inherit' });
        log('✅ Dependencies installed successfully.');
      } catch (error) {
        log(`❌ Error installing dependencies: ${error.message}`);
        log('Please run npm install manually to fix any dependency issues.');
        return false;
      }
    } else {
      log('✅ node_modules directory found.');
    }
    
    return true;
  } catch (error) {
    log(`❌ Error checking dependencies: ${error.message}`);
    return false;
  }
}

// Run database initialization
function initializeDatabase() {
  log('Initializing database...');
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
    log('Created data directory.');
  }
  
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
    log('Created logs directory.');
  }
  
  try {
    // Run the database initialization function directly
    const { initializeDatabase } = require('./utils/database');
    
    return initializeDatabase()
      .then(() => {
        log('✅ Database initialized successfully.');
        return true;
      })
      .catch(error => {
        log(`❌ Error initializing database: ${error.message}`);
        return false;
      });
  } catch (error) {
    log(`❌ Error loading database module: ${error.message}`);
    return Promise.resolve(false);
  }
}

// Start the server
function startServer() {
  log('Starting Memecoin Observatory MCP server...');
  
  // Run the server
  const server = spawn('node', ['server.js'], { stdio: 'inherit' });
  
  server.on('error', (error) => {
    log(`❌ Error starting server: ${error.message}`);
  });
  
  server.on('close', (code) => {
    if (code !== 0) {
      log(`❌ Server exited with code ${code}`);
    } else {
      log('✅ Server stopped.');
    }
  });
  
  // Handle CTRL+C to gracefully exit
  process.on('SIGINT', () => {
    log('Stopping server...');
    server.kill('SIGINT');
    rl.close();
  });
}

// Main startup function
async function startup() {
  console.log('\n=== Memecoin Observatory MCP Server ===\n');
  
  // Check environment file
  const envOk = checkEnvFile();
  
  // Check dependencies
  const depsOk = checkDependencies();
  
  if (!depsOk) {
    log('❌ Dependency check failed. Please fix the issues above and try again.');
    rl.close();
    return;
  }
  
  // Initialize database
  const dbOk = await initializeDatabase();
  
  if (!dbOk) {
    log('❌ Database initialization failed. Please fix the issues above and try again.');
    rl.close();
    return;
  }
  
  if (!envOk) {
    rl.question('Do you want to edit your .env file before starting the server? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        log('Please edit the .env file with your configuration and restart this script.');
        rl.close();
        return;
      } else {
        log('⚠️ Starting with default values. Some features may not work without proper configuration.');
        startServer();
      }
    });
  } else {
    startServer();
  }
}

// Run the startup function
startup();
