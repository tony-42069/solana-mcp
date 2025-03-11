graph TD
    root["D:\AI Projects\solana-mcp"] --> server.js
    root --> setup.js
    root --> package.json
    root --> README.md
    
    root --> utils["utils/"]
    utils --> database.js
    utils --> tokenUtils.js
    utils --> socialUtils.js
    utils --> safetyUtils.js
    
    root --> functions["functions/"]
    functions --> scanNewMemecoins.js
    functions --> getHypeScore.js
    functions --> trackWhaleMovements.js
    functions --> analyzeMemeCorrelation.js
    functions --> runRugpullScan.js
    functions --> getPortfolioStrategy.js
    
    root --> config["config/"]
    config --> app-config.js
    
    root --> data["data/"]
    data --> memecoin_observatory.db["memecoin_observatory.db (generated)"]
    
    root --> logs["logs/"]
    logs --> app.log["app.log (generated)"]
    logs --> error.log["error.log (generated)"]