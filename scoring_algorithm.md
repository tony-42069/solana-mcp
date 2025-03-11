flowchart TD
    start[Start Analysis] --> token[Memecoin Token]
    
    subgraph "On-Chain Analysis"
        token --> age[Token Age & Novelty]
        token --> supply[Supply Metrics]
        token --> holders[Holder Distribution]
        token --> liquidity[Liquidity Depth]
        
        age --> noveltyScore[Novelty Score]
        supply --> supplyScore[Supply Score]
        holders --> distributionScore[Distribution Score]
        liquidity --> liquidityScore[Liquidity Score]
        
        noveltyScore & supplyScore & distributionScore & liquidityScore --> onChainScore[On-Chain Score]
    end
    
    subgraph "Social Signal Analysis"
        token --> twitter[Twitter Mentions]
        token --> reddit[Reddit Activity]
        token --> telegram[Telegram Groups]
        
        twitter --> twitterEngagement[Twitter Engagement]
        reddit --> redditEngagement[Reddit Engagement]
        telegram --> telegramEngagement[Telegram Engagement]
        
        twitterEngagement & redditEngagement & telegramEngagement --> socialScore[Social Score]
    end
    
    subgraph "Meme Correlation Analysis"
        token --> trend[Trending Memes]
        token --> name[Token Name/Symbol]
        
        trend & name --> correlation[Correlation Calculation]
        correlation --> memeScore[Meme Score]
    end
    
    subgraph "Safety Analysis"
        token --> contract[Contract Analysis]
        token --> rugRisk[Rugpull Risk]
        
        contract & rugRisk --> safetyScore[Safety Score]
    end
    
    onChainScore --> |0.3| weightedSum[Weighted Sum]
    socialScore --> |0.3| weightedSum
    memeScore --> |0.2| weightedSum
    safetyScore --> |0.2| weightedSum
    
    weightedSum --> opportunityScore[Final Opportunity Score]
    opportunityScore --> portfolio[Portfolio Recommendations]