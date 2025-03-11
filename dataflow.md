sequenceDiagram
    participant User
    participant Claude as Claude AI
    participant MCP as MCP Server
    participant Solana as Solana Blockchain
    participant Social as Social Media
    participant Memes as Meme Tracker
    participant DB as Database
    
    User->>Claude: Ask about memecoin potential
    Claude->>MCP: Call analyzeMemeCorrelation()
    MCP->>DB: Get recent memecoins
    DB-->>MCP: Return memecoin data
    MCP->>Memes: Track trending memes
    Memes-->>MCP: Return trending memes
    MCP->>Social: Get social signals
    Social-->>MCP: Return social data
    MCP->>Solana: Get on-chain metrics
    Solana-->>MCP: Return blockchain data
    MCP->>MCP: Calculate correlations
    MCP->>DB: Store correlation results
    MCP-->>Claude: Return analysis
    Claude-->>User: Provide insights & recommendations