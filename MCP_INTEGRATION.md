# Memecoin Observatory MCP - Integration Guide

This document explains how to set up and use the Solana Memecoin Observatory with Claude AI.

## Set-up Instructions

### Step 1: Install and Run the Server

First, follow these steps to get the MCP server running:

```bash
# Clone the repository (if needed)
git clone https://github.com/your-username/solana-mcp.git
cd solana-mcp

# Install dependencies
npm install

# Initialize sample data for testing
npm run init-samples

# Start the server
npm start
```

The server will be available at `http://localhost:3000`.

### Step 2: Connect to Claude Desktop

To connect Claude Desktop to your MCP server:

1. Open Claude Desktop application
2. Go to Settings
3. Navigate to MCP Settings
4. Add a new MCP server with URL: `http://localhost:3000`
5. Enter a name like "Solana Memecoin Observatory"
6. Save your settings

### Step 3: Test the Connection

To test that Claude can access your MCP server, you can ask:

"What capabilities does your Solana Memecoin Observatory MCP server provide?"

Claude should respond by listing the available functions and what they do.

## Example Prompts

Here are some example prompts to use with Claude once the MCP is connected:

### Discover New Memecoins
```
Use your MCP tools to scan for the most recent memecoin launches on Solana.
```

### Analyze a Token's Safety
```
Analyze this Solana memecoin for rugpull risk: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

### Track Whale Movements
```
Can you track recent whale movements for the BONK token?
```

### Analyze Meme Correlations
```
Which memecoins currently have the strongest correlation with trending memes?
```

### Generate a Portfolio Strategy
```
Generate a moderate-risk memecoin portfolio strategy for a $1000 investment.
```

## Troubleshooting

If you encounter issues with the MCP connection:

1. **Server not responding**: Make sure the server is running on port 3000
2. **Function errors**: Check if sample data is initialized with `npm run init-samples`
3. **Connection issues**: Ensure Claude Desktop has the correct server URL
4. **"Cannot GET /mcp/execute"**: This endpoint only accepts POST requests, which will work correctly from Claude
5. **Missing functions**: Restart the server to ensure all functions are properly loaded

## Advanced Testing

For a more comprehensive test of all MCP functions, run:

```bash
node test-mcp-functions.js
```

This will attempt to call each function and report the results.
