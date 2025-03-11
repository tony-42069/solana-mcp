const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Connection } = require('@solana/web3.js');
const winston = require('winston');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./utils/database');
const config = require('./config/app-config');

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: path.join(config.logging.directory, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(config.logging.directory, 'combined.log')
    })
  ]
});

// Ensure log directory exists
if (!fs.existsSync(config.logging.directory)) {
  fs.mkdirSync(config.logging.directory, { recursive: true });
}

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors());

// Initialize Solana connection
const mainnetConnection = new Connection(config.solana.mainnetUrl, {
  commitment: config.solana.commitment
});
const devnetConnection = new Connection(config.solana.devnetUrl, {
  commitment: config.solana.commitment
});

// Dynamic function loading
const functionFiles = fs.readdirSync(path.join(__dirname, 'functions'))
  .filter(file => file.endsWith('.js'));

const functions = {};
const functionSchemas = [];

for (const file of functionFiles) {
  const functionName = file.split('.')[0];
  const functionModule = require(`./functions/${file}`);
  
  // Store function reference
  functions[functionName] = functionModule.handler;
  
  // Store function schema for MCP
  functionSchemas.push({
    name: functionName,
    description: functionModule.description,
    parameters: functionModule.parameters
  });
  
  logger.info(`Loaded function: ${functionName}`);
}

// MCP schema endpoint
app.get(config.mcp.baseUrl, (req, res) => {
  const schema = {
    schema_version: config.mcp.schemaVersion,
    metadata: {
      name: config.mcp.name,
      description: config.mcp.description,
      version: config.mcp.version
    },
    functions: functionSchemas
  };
  
  res.json(schema);
});

// MCP function execution endpoint
app.post(config.mcp.executeUrl, async (req, res) => {
  const { name, parameters } = req.body;
  
  logger.info(`Received execution request for: ${name}`);
  logger.info(`With parameters: ${JSON.stringify(parameters)}`);
  
  if (!functions[name]) {
    logger.error(`Function not found: ${name}`);
    return res.status(400).json({ error: `Function ${name} not found` });
  }
  
  try {
    logger.info(`Executing function: ${name}`);
    const result = await functions[name]({
      mainnetConnection,
      devnetConnection,
      logger,
      parameters
    });
    
    logger.info(`Function ${name} executed successfully`);
    res.json({ result });
  } catch (error) {
    logger.error(`Error executing ${name}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});

// Also add a GET handler for the execute endpoint for better error messages
app.get(config.mcp.executeUrl, (req, res) => {
  res.status(405).json({ 
    error: "Method not allowed", 
    message: "This endpoint requires a POST request with a JSON body containing 'name' and 'parameters' fields." 
  });
});

// Simple status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Documentation endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Memecoin Observatory MCP</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #f7931a; }
          pre { background-color: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Memecoin Observatory MCP</h1>
        <p>This is a Model Context Protocol server for analyzing Solana memecoins.</p>
        <p>Available endpoints:</p>
        <ul>
          <li><a href="/mcp">/mcp</a> - Get MCP schema</li>
          <li><a href="/status">/status</a> - Get server status</li>
        </ul>
        <p>For more details, visit the <a href="https://github.com/tony-42069/solana-mcp">GitHub repository</a>.</p>
      </body>
    </html>
  `);
});

// Schedule background tasks
if (config.scheduledTasks.tokenDiscovery.enabled) {
  cron.schedule(config.scheduledTasks.tokenDiscovery.schedule, async () => {
    logger.info('Running scheduled token discovery task');
    try {
      if (functions.scanNewMemecoins) {
        await functions.scanNewMemecoins({
          mainnetConnection,
          devnetConnection,
          logger,
          parameters: { limit: config.scheduledTasks.tokenDiscovery.limit }
        });
      }
    } catch (error) {
      logger.error(`Error in token discovery task: ${error.message}`);
    }
  });
}

if (config.scheduledTasks.socialUpdate.enabled) {
  cron.schedule(config.scheduledTasks.socialUpdate.schedule, async () => {
    logger.info('Running scheduled social signals update task');
    try {
      // Get recent tokens
      const { query } = require('./utils/database');
      const tokens = await query(`
        SELECT * FROM tokens 
        WHERE is_memecoin = 1 
        ORDER BY discovery_date DESC 
        LIMIT ?
      `, [config.scheduledTasks.socialUpdate.limit]);
      
      // Update social signals for each token
      for (const token of tokens) {
        try {
          if (functions.getHypeScore) {
            await functions.getHypeScore({
              mainnetConnection,
              logger,
              parameters: { tokenAddress: token.address }
            });
          }
        } catch (tokenError) {
          logger.error(`Error updating social signals for ${token.address}: ${tokenError.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error in social update task: ${error.message}`);
    }
  });
}

if (config.scheduledTasks.memeCorrelation.enabled) {
  cron.schedule(config.scheduledTasks.memeCorrelation.schedule, async () => {
    logger.info('Running scheduled meme correlation task');
    try {
      if (functions.analyzeMemeCorrelation) {
        await functions.analyzeMemeCorrelation({
          logger,
          parameters: { includeTrendingReport: true }
        });
      }
    } catch (error) {
      logger.error(`Error in meme correlation task: ${error.message}`);
    }
  });
}

// Initialize database before starting server
initializeDatabase()
  .then(() => {
    const PORT = config.server.port;
    app.listen(PORT, () => {
      logger.info(`Memecoin Observatory MCP server running on port ${PORT}`);
      logger.info(`MCP Schema available at: http://localhost:${PORT}${config.mcp.baseUrl}`);
      logger.info(`MCP Execute endpoint: http://localhost:${PORT}${config.mcp.executeUrl}`);
    });
  })
  .catch(error => {
    logger.error(`Failed to initialize database: ${error.message}`);
    process.exit(1);
  });
