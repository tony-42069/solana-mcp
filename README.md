# Memecoin Observatory MCP for Solana

![MCP Banner](https://i.imgur.com/placeholder.png)

> A comprehensive Solana MCP (Model Context Protocol) server for analyzing memecoins, tracking trends, and providing AI-powered insights using cultural analysis and on-chain data.

## 🚀 Overview

The Memecoin Observatory is a unique Solana MCP that enables AI assistants like Claude to analyze and understand the memecoin ecosystem. It combines on-chain data analysis with cultural trend monitoring to provide insights that would be impossible for a human to gather manually.

### Key Features

- **🔍 Real-time Memecoin Radar**: Track and identify new memecoin launches on Solana in real-time
- **📊 Social Signal Analyzer**: Monitor Twitter, Reddit, and Telegram for early memecoin mentions
- **🐋 Whale Wallet Tracker**: Identify and track wallets that historically buy early into successful memecoins
- **🌐 Meme Culture Correlator**: Analyze trending internet memes and correlate them with potential new tokens
- **🛡️ Rugpull Protection**: Scan contract code and developer wallets for common rugpull patterns
- **💼 Personalized Portfolio Advisor**: Recommend memecoin entry/exit strategies based on market conditions

## 📋 Prerequisites

- Node.js (v16+)
- npm or yarn
- Solana CLI (optional but recommended)

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/tony-42069/solana-mcp.git
cd solana-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on the provided `.env.example`:
```bash
cp .env.example .env
```

4. Configure your environment variables in the `.env` file.

## 🏃‍♂️ Running the MCP Server

Start the server with:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The server will be available at:
- MCP Schema: `http://localhost:3000/mcp`
- MCP Execute: `http://localhost:3000/mcp/execute`
- Documentation: `http://localhost:3000/`

## 📡 Connecting to Claude

To connect your MCP server to Claude Desktop or other MCP clients:

1. Make sure your server is running and accessible from the internet (using ngrok, Cloudflare Tunnel, or proper hosting)
2. Register your MCP server URL in the Claude Desktop app
3. You can now ask Claude about Solana memecoins and use the functionality provided by this MCP

## 🔎 Available Functions

### 1. Scan New Memecoins
```javascript
// Scan for newly created memecoin tokens on Solana
{
  "name": "scanNewMemecoins",
  "parameters": {
    "limit": 100
  }
}
```

### 2. Get Hype Score
```javascript
// Calculate a "hype score" for a memecoin based on social signals and on-chain activity
{
  "name": "getHypeScore",
  "parameters": {
    "tokenAddress": "TokenAddressHere"
  }
}
```

### 3. Track Whale Movements
```javascript
// Track whale wallet movements for Solana memecoins
{
  "name": "trackWhaleMovements",
  "parameters": {
    "tokenAddress": "OptionalTokenAddressHere",
    "limit": 10,
    "minAmount": 1000
  }
}
```

### 4. Analyze Meme Correlation
```javascript
// Analyze correlation between memecoin tokens and current trending memes
{
  "name": "analyzeMemeCorrelation",
  "parameters": {
    "tokenAddress": "OptionalTokenAddressHere",
    "includeTrendingReport": true
  }
}
```

### 5. Run Rugpull Scan
```javascript
// Analyze a memecoin for rugpull and scam risks
{
  "name": "runRugpullScan",
  "parameters": {
    "tokenAddress": "TokenAddressHere"
  }
}
```

### 6. Get Portfolio Strategy
```javascript
// Generate a personalized memecoin portfolio strategy based on risk profile
{
  "name": "getPortfolioStrategy",
  "parameters": {
    "riskTolerance": "moderate",
    "investmentSize": 1000,
    "existingPortfolio": [
      {
        "address": "ExistingTokenAddressHere",
        "amount": 100
      }
    ]
  }
}
```

## 📊 Example Use Cases

1. **Find Early Stage Opportunities**: "Which new memecoins launched in the past 24 hours have the highest correlation with trending memes?"

2. **Safety Analysis**: "Is this memecoin (address) likely to be a rugpull? What are the risk factors?"

3. **Portfolio Construction**: "Help me build a moderate-risk $1000 memecoin portfolio on Solana that balances safety with upside potential."

4. **Trend Analysis**: "What meme themes are gaining traction that don't yet have associated tokens?"

5. **Whale Tracking**: "Have any major whale wallets made significant purchases of memecoins in the past week?"

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This tool is for educational and informational purposes only. Memecoins are highly speculative investments with significant risk of loss. Always do your own research and never invest more than you can afford to lose.