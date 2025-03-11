graph TD
    subgraph "Client Layer"
        Claude["Claude AI Assistant"]
        OtherAI["Other AI Assistants"]
        Claude --> |MCP Protocol| Server
        OtherAI --> |MCP Protocol| Server
    end

    subgraph "MCP Server"
        Server["Express.js Server"]
        
        subgraph "MCP Functions"
            SF["scanNewMemecoins()"]
            HS["getHypeScore()"]
            TW["trackWhaleMovements()"]
            MC["analyzeMemeCorrelation()"]
            RP["runRugpullScan()"]
            PS["getPortfolioStrategy()"]
        end
        
        Server --> SF
        Server --> HS
        Server --> TW
        Server --> MC
        Server --> RP
        Server --> PS
    end
    
    subgraph "Data Layer"
        DB[(SQLite Database)]
        SF --> DB
        HS --> DB
        TW --> DB
        MC --> DB
        RP --> DB
        PS --> DB
    end
    
    subgraph "External Data Sources"
        Solana["Solana Blockchain"]
        Social["Social Media APIs"]
        MemeTracker["Meme Tracking Web Scraper"]
        DEX["DEX Liquidity Data"]
        
        SF --> Solana
        HS --> Social
        HS --> DEX
        TW --> Solana
        MC --> MemeTracker
        RP --> Solana
        RP --> DEX
        PS --> DB
    end