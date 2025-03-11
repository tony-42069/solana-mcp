const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ensure necessary directories exist
const directories = ['data', 'logs', 'functions', 'utils', 'config'];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    console.log(`Created directory: ${dir}`);
  }
});

// Install dependencies
console.log('Installing dependencies...');
const npmInstall = spawn('npm', ['install']);

npmInstall.stdout.on('data', (data) => {
  console.log(`${data}`);
});

npmInstall.stderr.on('data', (data) => {
  console.error(`${data}`);
});

npmInstall.on('close', (code) => {
  console.log(`npm install exited with code ${code}`);
  
  if (code === 0) {
    console.log('Dependencies installed successfully!');
    setupEnv();
  } else {
    console.error('Error installing dependencies. Please try running npm install manually.');
    process.exit(1);
  }
});

// Setup environment variables
function setupEnv() {
  // Check if .env file exists
  if (fs.existsSync('.env')) {
    console.log('.env file already exists. Skipping environment setup.');
    initializeDatabase();
    return;
  }
  
  console.log('\nSetting up environment variables...');
  
  rl.question('Enter Solana RPC URL (default: https://api.mainnet-beta.solana.com): ', (solanaRpcUrl) => {
    const rpcUrl = solanaRpcUrl || 'https://api.mainnet-beta.solana.com';
    
    rl.question('Enter port for the server (default: 3000): ', (port) => {
      const serverPort = port || '3000';
      
      // Create .env file
      const envContent = `# Server configuration
PORT=${serverPort}
NODE_ENV=development

# Solana configuration
SOLANA_RPC_URL=${rpcUrl}
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
      
      fs.writeFileSync('.env', envContent);
      console.log('.env file created successfully!');
      
      initializeDatabase();
    });
  });
}

// Initialize database
function initializeDatabase() {
  console.log('\nInitializing database...');
  
  // Run the database initialization function
  const { initializeDatabase } = require('./utils/database');
  
  initializeDatabase()
    .then(() => {
      console.log('Database initialized successfully!');
      console.log('Database schema created with the following tables:');
      console.log('  - tokens: Stores memecoin token information');
      console.log('  - token_metrics: Stores price and volume metrics');
      console.log('  - social_signals: Stores social media engagement data');
      console.log('  - whale_movements: Tracks large wallet transactions');
      console.log('  - meme_correlations: Links tokens with trending memes');
      console.log('  - safety_scores: Security and rugpull risk assessments');
      
      startServer();
    })
    .catch(error => {
      console.error(`Error initializing database: ${error.message}`);
      process.exit(1);
    });
}

// Start server
function startServer() {
  console.log('\nStarting server...');
  
  rl.question('Do you want to start the server now? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      console.log('Starting server...');
      
      const server = spawn('node', ['server.js']);
      
      server.stdout.on('data', (data) => {
        console.log(`${data}`);
      });
      
      server.stderr.on('data', (data) => {
        console.error(`${data}`);
      });
      
      server.on('close', (code) => {
        console.log(`Server exited with code ${code}`);
        rl.close();
        process.exit(code);
      });
    } else {
      console.log('Setup complete! You can start the server by running:');
      console.log('  npm start');
      rl.close();
      process.exit(0);
    }
  });
}
