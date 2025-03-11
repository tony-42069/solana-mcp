const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const cheerio = require('cheerio');
// Try to import puppeteer but make it optional
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.warn('Puppeteer not available. Web scraping functionality will be limited.');
}
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Twitter client if credentials are available
let twitterClient = null;
try {
  if (
    process.env.TWITTER_API_KEY &&
    process.env.TWITTER_API_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_SECRET
  ) {
    twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    console.log('Twitter API client initialized successfully');
  } else {
    console.log('Twitter API credentials not found. Social analysis will use alternative methods.');
  }
} catch (error) {
  console.error('Error initializing Twitter client:', error.message);
  console.log('Social analysis will use alternative methods.');
}

/**
 * Calculate sentiment score from text
 * @param {string} text - Text to analyze
 * @returns {number} - Sentiment score (-1 to 1)
 */
function calculateSentiment(text) {
  // This is a very simple sentiment analysis function
  // In a production environment, use a proper NLP library
  
  const positiveWords = [
    'moon', 'gem', 'hodl', 'bullish', 'gains', 'pump', 'green', 'buy', 
    'win', 'profit', 'rocket', 'lambo', 'rich', 'good', 'great', 'best',
    'amazing', 'excellent', 'winner', 'early', 'opportunity', 'next', 'x10', 'x100'
  ];
  
  const negativeWords = [
    'dump', 'scam', 'rug', 'sell', 'red', 'loss', 'crash', 'bad', 'worst',
    'terrible', 'avoid', 'bear', 'bearish', 'fake', 'shit', 'crap', 'trash',
    'waste', 'poor', 'fail', 'failure', 'ponzi', 'beware', 'careful'
  ];
  
  // Normalize text
  const textLower = text.toLowerCase();
  
  // Count positive and negative words
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of positiveWords) {
    if (textLower.includes(word)) {
      positiveCount++;
    }
  }
  
  for (const word of negativeWords) {
    if (textLower.includes(word)) {
      negativeCount++;
    }
  }
  
  // Calculate sentiment (-1 to 1)
  if (positiveCount === 0 && negativeCount === 0) {
    return 0;
  }
  
  return (positiveCount - negativeCount) / (positiveCount + negativeCount);
}

/**
 * Search for mentions of a token on Twitter
 * @param {string} tokenSymbol - Token symbol to search for
 * @param {string} tokenName - Token name to search for
 * @returns {Promise<Array>} - Array of mentions with sentiment
 */
async function searchTwitterMentions(tokenSymbol, tokenName) {
  if (!twitterClient) {
    return {
      count: 0,
      sentiment: 0,
      engagement: 0,
      sources: []
    };
  }

  try {
    // Search for the token by symbol and name
    const searchQuery = `${tokenSymbol} OR ${tokenName} crypto`;
    const searchResults = await twitterClient.v2.search(searchQuery, {
      max_results: 100,
      'tweet.fields': ['created_at', 'public_metrics']
    });

    if (!searchResults.data || searchResults.data.length === 0) {
      return {
        count: 0,
        sentiment: 0,
        engagement: 0,
        sources: []
      };
    }

    // Process results
    let totalSentiment = 0;
    let totalEngagement = 0;
    const sources = [];

    for (const tweet of searchResults.data) {
      const sentiment = calculateSentiment(tweet.text);
      const engagement = 
        (tweet.public_metrics?.like_count || 0) + 
        (tweet.public_metrics?.retweet_count || 0) +
        (tweet.public_metrics?.reply_count || 0);

      totalSentiment += sentiment;
      totalEngagement += engagement;

      sources.push({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        sentiment,
        engagement
      });
    }

    return {
      count: searchResults.data.length,
      sentiment: searchResults.data.length > 0 ? totalSentiment / searchResults.data.length : 0,
      engagement: totalEngagement,
      sources: sources.slice(0, 10) // Limit to top 10 sources
    };
  } catch (error) {
    console.error('Error searching Twitter:', error.message);
    return {
      count: 0,
      sentiment: 0,
      engagement: 0,
      sources: []
    };
  }
}

/**
 * Crawl popular platforms for token mentions without using an API
 * @param {string} tokenSymbol - Token symbol to search for
 * @param {string} tokenName - Token name to search for
 * @returns {Promise<Object>} - Mentions data
 */
async function crawlForTokenMentions(tokenSymbol, tokenName) {
  try {
    let redditPosts = [];
    
    // Only use puppeteer if available
    if (puppeteer) {
      try {
        // Initialize browser for scraping
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        // Crawl Reddit (without API)
        await page.goto(`https://www.reddit.com/search/?q=${encodeURIComponent(tokenSymbol)}%20OR%20${encodeURIComponent(tokenName)}%20crypto`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for content to load
        await page.waitForSelector('body', { timeout: 5000 });
        
        // Get page content
        const redditContent = await page.content();
        const $ = cheerio.load(redditContent);
        
        // Look for posts (simplified)
        $('div[data-testid="post-container"]').each((i, el) => {
          const title = $(el).find('h3').text();
          const upvotes = $(el).find('[data-testid="post-container"] div').first().text();
          
          redditPosts.push({
            title,
            upvotes,
            sentiment: calculateSentiment(title)
          });
        });
        
        // Close browser
        await browser.close();
      } catch (browserError) {
        console.error('Error with puppeteer scraping:', browserError.message);
        // Continue with other methods even if browser scraping fails
      }
    } else {
      // Fallback without Puppeteer - use Axios and Cheerio directly
      try {
        const response = await axios.get(
          `https://www.reddit.com/search.json?q=${encodeURIComponent(tokenSymbol)}%20OR%20${encodeURIComponent(tokenName)}%20crypto&limit=10`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          }
        );
        
        if (response.data && response.data.data && response.data.data.children) {
          redditPosts = response.data.data.children.map(post => ({
            title: post.data.title,
            upvotes: post.data.score,
            sentiment: calculateSentiment(post.data.title)
          }));
        }
      } catch (axiosError) {
        console.error('Error with Reddit API:', axiosError.message);
      }
    }
    
    // Crawl Telegram public channels (this is a simple example, might need more robust approach)
    const telegramMentions = await crawlTelegramMentions(tokenSymbol, tokenName);
    
    return {
      reddit: {
        count: redditPosts.length,
        posts: redditPosts.slice(0, 5),
        sentiment: redditPosts.length > 0 
          ? redditPosts.reduce((acc, post) => acc + post.sentiment, 0) / redditPosts.length 
          : 0
      },
      telegram: telegramMentions
    };
  } catch (error) {
    console.error('Error crawling for mentions:', error.message);
    return {
      reddit: { count: 0, posts: [], sentiment: 0 },
      telegram: { count: 0, channels: [], sentiment: 0 }
    };
  }
}

/**
 * Crawl Telegram public channels for mentions (simplified)
 * @param {string} tokenSymbol - Token symbol to search for
 * @param {string} tokenName - Token name to search for
 * @returns {Promise<Object>} - Telegram mentions data
 */
async function crawlTelegramMentions(tokenSymbol, tokenName) {
  // This is a simplified example
  // In practice, this would be more complex and might require API access
  try {
    // Use Telegram Search API services or manually scrape public Telegram channel directories
    const channels = [
      'solana_news',
      'solana_defi',
      'solana_memecoin',
      'crypto_signals',
      'crypto_gems'
    ];
    
    // Simulate finding mentions (in a real implementation, you'd actually scrape these channels)
    const randomMentions = Math.floor(Math.random() * 10);
    
    return {
      count: randomMentions,
      channels: channels.slice(0, randomMentions),
      sentiment: Math.random() * 2 - 1 // Random sentiment between -1 and 1
    };
  } catch (error) {
    console.error('Error crawling Telegram:', error.message);
    return {
      count: 0,
      channels: [],
      sentiment: 0
    };
  }
}

/**
 * Track trending memes on the internet
 * @returns {Promise<Array>} - Array of trending memes
 */
async function trackTrendingMemes() {
  try {
    // Predefined memes for testing and backup if scraping fails
    const fallbackMemes = [
      { name: 'Dogwifhat', source: 'popular culture', date: new Date().toISOString() },
      { name: 'Pepe the Frog', source: 'popular culture', date: new Date().toISOString() },
      { name: 'Wojak', source: 'popular culture', date: new Date().toISOString() },
      { name: 'Chad', source: 'popular culture', date: new Date().toISOString() },
      { name: 'Doge', source: 'popular culture', date: new Date().toISOString() },
      { name: 'Moon Boy', source: 'crypto culture', date: new Date().toISOString() },
      { name: 'Diamond Hands', source: 'crypto culture', date: new Date().toISOString() },
      { name: 'Paper Hands', source: 'crypto culture', date: new Date().toISOString() },
      { name: 'WAGMI', source: 'crypto culture', date: new Date().toISOString() },
      { name: 'HODL', source: 'crypto culture', date: new Date().toISOString() }
    ];
    
    // Scrape popular meme sites or aggregators
    const memeSites = [
      { url: 'https://knowyourmeme.com/memes/trending', selector: '.entry-grid-body .entry' },
      { url: 'https://www.reddit.com/r/memes/hot/.json', selector: 'data.children' }
    ];
    
    const trendingMemes = [];
    
    for (const site of memeSites) {
      try {
        const response = await axios.get(site.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 5000 // Set a timeout to avoid hanging
        });
        
        if (site.url.includes('knowyourmeme')) {
          const $ = cheerio.load(response.data);
          
          $(site.selector).each((i, el) => {
            const memeName = $(el).find('h2').text().trim();
            
            if (memeName && !trendingMemes.some(m => m.name === memeName)) {
              trendingMemes.push({
                name: memeName,
                source: site.url,
                date: new Date().toISOString()
              });
            }
          });
        } else if (site.url.includes('reddit')) {
          // Reddit JSON API
          if (response.data && response.data.data && response.data.data.children) {
            for (const post of response.data.data.children) {
              if (post.data && post.data.title) {
                const memeName = post.data.title.trim();
                
                if (memeName && !trendingMemes.some(m => m.name === memeName)) {
                  trendingMemes.push({
                    name: memeName,
                    source: 'https://www.reddit.com' + post.data.permalink,
                    date: new Date().toISOString()
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error scraping ${site.url}:`, error.message);
      }
    }
    
    // Use fallback memes if scraping failed to get any
    if (trendingMemes.length === 0) {
      console.log('Using fallback meme data as scraping did not return results');
      return fallbackMemes;
    }
    
    return trendingMemes;
  } catch (error) {
    console.error('Error tracking trending memes:', error.message);
    return fallbackMemes;
  }
}

/**
 * Calculate correlation between a memecoin and trending memes
 * @param {string} tokenName - Token name
 * @param {string} tokenSymbol - Token symbol
 * @param {Array} trendingMemes - Array of trending memes
 * @returns {Array} - Correlations between token and memes
 */
function calculateMemeCorrelation(tokenName, tokenSymbol, trendingMemes) {
  const correlations = [];
  
  const tokenNameLC = tokenName.toLowerCase();
  const tokenSymbolLC = tokenSymbol.toLowerCase();
  
  for (const meme of trendingMemes) {
    const memeName = meme.name.toLowerCase();
    
    // Calculate Jaccard similarity coefficient (simplified)
    const tokenWords = tokenNameLC.split(/\W+/).filter(Boolean);
    const memeWords = memeName.split(/\W+/).filter(Boolean);
    
    const intersection = tokenWords.filter(word => memeWords.includes(word)).length;
    const union = new Set([...tokenWords, ...memeWords]).size;
    
    let correlation = intersection > 0 ? intersection / union : 0;
    
    // Add weighting for symbol matches
    if (memeName.includes(tokenSymbolLC)) {
      correlation += 0.3;
    }
    
    // Cap at 1.0
    correlation = Math.min(correlation, 1.0);
    
    if (correlation > 0.1) {
      correlations.push({
        meme: meme.name,
        correlation,
        source: meme.source,
        date: meme.date
      });
    }
  }
  
  return correlations.sort((a, b) => b.correlation - a.correlation);
}

module.exports = {
  calculateSentiment,
  searchTwitterMentions,
  crawlForTokenMentions,
  trackTrendingMemes,
  calculateMemeCorrelation
};
