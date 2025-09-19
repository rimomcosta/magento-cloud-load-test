/**
 * Enhanced Magento Load Test Script for k6
 * 
 * This script performs comprehensive e-commerce load testing on Magento websites, covering:
 * - Complete end-to-end user journeys
 * - Multi-category browsing sessions
 * - Product comparison and cross-shopping
 * - Realistic cart and checkout flows
 * - Homepage, Category, Product, Search, Cart, and Checkout performance
 * - API load testing (REST and GraphQL)
 * 
 * USAGE:
 *   MAGENTO_URL=https://your-site.com k6 run k6-magento-load-test.js
 *   ./run-load-test.sh https://your-site.com
 * 
 * CONFIGURATION:
 *   - Default configuration is embedded in the script
 *   - Override any setting by creating 'load-test-config.yaml' in the same directory
 *   - All test parameters can be customized via the YAML config file
 *   - YAML format supports explanatory comments for each setting
 * 
 * USER JOURNEYS:
 *   1. Comprehensive Shopping: Multi-category browsing with product comparison
 *   2. Browse & Purchase: Category → Product → Cart → Checkout
 *   3. Search & Purchase: Search → Product → Cart
 *   4. Cart Abandonment: Browse → Add to Cart → Abandon at Checkout
 *   5. Window Shopping: Browse multiple categories and products
 *   6. Quick Buyer: Direct product purchase
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

// Load configuration from YAML file if available
let config = {};
try {
  const configFile = open('./load-test-config.yaml');
  // Simple YAML parser for our specific format
  const lines = configFile.split('\n');
  const result = {};
  let currentSection = result;
  let sectionStack = [result];
  let sectionNames = [''];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // Skip comments and empty lines
    
    const indent = line.length - line.trimStart().length;
    const colonIndex = trimmed.indexOf(':');
    
    if (colonIndex > 0) {
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      // Adjust section stack based on indentation
      const depth = Math.floor(indent / 2);
      while (sectionStack.length > depth + 1) {
        sectionStack.pop();
        sectionNames.pop();
      }
      currentSection = sectionStack[sectionStack.length - 1];
      
      if (value === '' || value === '[]') {
        // This is a section header or array start
        currentSection[key] = value === '[]' ? [] : {};
        sectionStack.push(currentSection[key]);
        sectionNames.push(key);
        currentSection = currentSection[key];
      } else if (value === '' && lines[lines.indexOf(line) + 1] && lines[lines.indexOf(line) + 1].trim().startsWith('- ')) {
        // This is an array header (next line starts with -)
        currentSection[key] = [];
        sectionStack.push(currentSection[key]);
        sectionNames.push(key);
        currentSection = currentSection[key];
      } else if (trimmed.startsWith('- ')) {
        // This is an array item
        const arrayValue = value.startsWith('"') ? value.slice(1, -1) : value;
        if (!Array.isArray(currentSection)) {
          const parentKey = sectionNames[sectionNames.length - 1];
          const parent = sectionStack[sectionStack.length - 2];
          parent[parentKey] = [];
          currentSection = parent[parentKey];
          sectionStack[sectionStack.length - 1] = currentSection;
        }
        currentSection.push(arrayValue);
      } else {
        // This is a key-value pair
        let parsedValue = value;
        
        // Remove inline comments (everything after #)
        const commentIndex = value.indexOf('#');
        if (commentIndex > 0) {
          parsedValue = value.substring(0, commentIndex).trim();
        }
        
        if (parsedValue.startsWith('"') && parsedValue.endsWith('"')) {
          parsedValue = parsedValue.slice(1, -1); // Remove quotes
        } else if (parsedValue === 'true') {
          parsedValue = true;
        } else if (parsedValue === 'false') {
          parsedValue = false;
        } else if (!isNaN(parsedValue) && !isNaN(parseFloat(parsedValue))) {
          parsedValue = parseFloat(parsedValue);
        }
        currentSection[key] = parsedValue;
      }
    } else if (trimmed.startsWith('- ')) {
      // Array item at root level or continuing array
      const arrayValue = trimmed.substring(2).trim();
      const cleanValue = arrayValue.startsWith('"') ? arrayValue.slice(1, -1) : arrayValue;
      if (Array.isArray(currentSection)) {
        currentSection.push(cleanValue);
      }
    }
  }
  
  config = result;
  console.log('✅ Loaded configuration from load-test-config.yaml');
} catch (e) {
  console.log('ℹ️  No config file found, using default configuration');
}

// =============================================================================
// DYNAMIC CONFIGURATION SYSTEM
// =============================================================================

// Target website - MUST be provided via environment variable MAGENTO_URL
const BASE_URL = __ENV.MAGENTO_URL;

// Validate that BASE_URL is provided
if (!BASE_URL) {
  throw new Error('MAGENTO_URL environment variable is required. Usage: MAGENTO_URL=https://your-site.com k6 run k6-magento-load-test.js');
}

// Helper function to get config value with fallback to default
function getConfig(path, defaultValue) {
  const keys = path.split('.');
  let value = config;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  return value;
}

// Load test parameters
const VIRTUAL_USERS = getConfig('loadTest.virtualUsers', 500);
const RAMP_UP_DURATION = getConfig('loadTest.rampUpDuration', '60s');
const SUSTAINED_DURATION = getConfig('loadTest.sustainedDuration', '5m');
const RAMP_DOWN_DURATION = getConfig('loadTest.rampDownDuration', '60s');

// HTTP timeout configuration
const HTTP_TIMEOUT = getConfig('performance.httpTimeout', '60s');

// Performance thresholds
const HTTP_ERROR_THRESHOLD = getConfig('performance.httpErrorThreshold', 0.25);
const HTTP_DURATION_THRESHOLD = getConfig('performance.httpDurationThreshold', 60000);
const HOMEPAGE_DURATION_THRESHOLD = getConfig('performance.homepageDurationThreshold', 45000);
const PRODUCT_DURATION_THRESHOLD = getConfig('performance.productDurationThreshold', 50000);
const CATEGORY_DURATION_THRESHOLD = getConfig('performance.categoryDurationThreshold', 50000);
const SEARCH_DURATION_THRESHOLD = getConfig('performance.searchDurationThreshold', 45000);
const CART_DURATION_THRESHOLD = getConfig('performance.cartDurationThreshold', 45000);

// User behavior simulation
const MIN_THINK_TIME = getConfig('userBehavior.minThinkTime', 1);
const MAX_THINK_TIME = getConfig('userBehavior.maxThinkTime', 4);
const BROWSE_JOURNEY_PERCENTAGE = getConfig('userBehavior.browseJourneyPercentage', 0.4);
const SEARCH_JOURNEY_PERCENTAGE = getConfig('userBehavior.searchJourneyPercentage', 0.2);
const CART_JOURNEY_PERCENTAGE = getConfig('userBehavior.cartJourneyPercentage', 0.1);
const WINDOW_SHOPPING_PERCENTAGE = getConfig('userBehavior.windowShoppingPercentage', 0.05);
const QUICK_BUYER_PERCENTAGE = getConfig('userBehavior.quickBuyerPercentage', 0.05);
const COMPREHENSIVE_SHOPPING_PERCENTAGE = getConfig('userBehavior.comprehensiveShoppingPercentage', 0.2);

// Enhanced e-commerce flow parameters
const MAX_CATEGORIES_PER_SESSION = getConfig('ecommerceFlow.maxCategoriesPerSession', 3);
const MAX_PRODUCTS_PER_CATEGORY = getConfig('ecommerceFlow.maxProductsPerCategory', 4);
const MAX_PRODUCTS_IN_CART = getConfig('ecommerceFlow.maxProductsInCart', 5);
const CHECKOUT_COMPLETION_RATE = getConfig('ecommerceFlow.checkoutCompletionRate', 0.7);
const CATEGORY_RETURN_RATE = getConfig('ecommerceFlow.categoryReturnRate', 0.6);
const PRODUCT_COMPARISON_RATE = getConfig('ecommerceFlow.productComparisonRate', 0.4);
const ADD_TO_CART_MIN_QTY = getConfig('ecommerceFlow.addToCartMinQty', 1);
const ADD_TO_CART_MAX_QTY = getConfig('ecommerceFlow.addToCartMaxQty', 3);

// HTTP headers
// Realistic browser simulation - Random user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];
const USER_AGENT = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const ACCEPT_LANGUAGE = 'en-US,en;q=0.5';

// URL discovery configuration
const MAX_PRODUCTS = getConfig('urlDiscovery.maxProducts', 500);
const MAX_CATEGORIES = getConfig('urlDiscovery.maxCategories', 50);
const MAX_SEARCH_TERMS = getConfig('urlDiscovery.maxSearchTerms', 20);
const EXCLUDED_URL_SUBSTRINGS = ['/admin', '/checkout', '/customer', '/catalogsearch', '/contact', '/privacy', '/terms', '/noroute'];
const ENABLE_URL_DISCOVERY = getConfig('urlDiscovery.enableUrlDiscovery', true);
const ENABLE_FALLBACK_URLS = getConfig('urlDiscovery.enableFallbackUrls', true);
const ENABLE_DEEP_CRAWLING = getConfig('urlDiscovery.enableDeepCrawling', false);
const MAX_CRAWL_DEPTH = getConfig('urlDiscovery.maxCrawlDepth', 1);
const VALIDATE_URLS_BEFORE_USE = getConfig('urlDiscovery.validateUrlsBeforeUse', false);

// Real URLs from configuration (with proper array handling)
const FALLBACK_CATEGORY_SLUGS = Array.isArray(getConfig('realUrls.fallbackCategorySlugs', null)) 
  ? getConfig('realUrls.fallbackCategorySlugs', null)
  : ['category-4', 'category-5', 'gear', 'training', 'collections/yoga-new'];

const REAL_PRODUCT_URLS = Array.isArray(getConfig('realUrls.realProductUrls', null))
  ? getConfig('realUrls.realProductUrls', null)
  : [
    'radiant-tee.html',
    'breathe-easy-tank.html',
    'argus-all-weather-tank.html',
    'hero-hoodie.html',
    'fusion-backpack.html',
    'push-it-messenger-bag.html',
    'sprite-yoga-companion-kit.html',
    'affirm-water-bottle.html',
    'quest-lumaflex-tone-band.html',
    'fitbit-charge-3.html'
  ];

const FALLBACK_SEARCH_TERMS = Array.isArray(getConfig('realUrls.fallbackSearchTerms', null))
  ? getConfig('realUrls.fallbackSearchTerms', null)
  : ['shirt', 'pants', 'shoes', 'bag', 'watch', 'dress', 'jacket', 'hat', 'belt', 'socks'];
const DEFAULT_SEARCH_TERM = 'shirt';

// Storefront paths
const CART_PAGE_PATH = getConfig('paths.cartPagePath', '/checkout/cart/');
const CHECKOUT_PAGE_PATH = getConfig('paths.checkoutPagePath', '/checkout/onepage/');
const ADD_TO_CART_PATH = getConfig('paths.addToCartPath', '/checkout/cart/add/');
const SEARCH_RESULT_PATH_TEMPLATE = getConfig('paths.searchResultPathTemplate', '/catalogsearch/result/?q={q}');
const GRAPHQL_PATH = getConfig('paths.graphqlPath', '/graphql');

// API traffic configuration
const ENABLE_API_LOAD = getConfig('api.enableApiLoad', true);
const ENABLE_GRAPHQL_LOAD = getConfig('api.enableGraphqlLoad', true);
const ENABLE_REST_LOAD = getConfig('api.enableRestLoad', true);
const API_TRAFFIC_PERCENTAGE = getConfig('api.apiTrafficPercentage', 0.3);
const GRAPHQL_SEARCH_PAGE_SIZE = getConfig('api.graphqlSearchPageSize', 5);

// REST config
const REST_STORE_CODE = 'default';
const REST_API_PREFIX = `/rest/${REST_STORE_CODE}/V1`;
const REST_ENDPOINTS_BROWSE = [`${REST_API_PREFIX}/store/storeViews`];
const REST_ENDPOINTS_CART = [`${REST_API_PREFIX}/directory/countries`];

// Cache bypass configuration
const CACHE_BYPASS_PERCENTAGE = getConfig('cache.cacheBypassPercentage', 0.3);
const ENABLE_CACHE_BYPASS = getConfig('cache.enableCacheBypass', true);

// Realistic browsing patterns configuration
const MAX_BROWSING_ACTIONS = getConfig('browsingPatterns.maxBrowsingActions', 12);
const MIN_BROWSING_ACTIONS = getConfig('browsingPatterns.minBrowsingActions', 5);
const RELATED_PRODUCT_FOLLOW_RATE = getConfig('browsingPatterns.relatedProductFollowRate', 0.4);
const PAGINATION_FOLLOW_RATE = getConfig('browsingPatterns.paginationFollowRate', 0.25);
const BREADCRUMB_FOLLOW_RATE = getConfig('browsingPatterns.breadcrumbFollowRate', 0.2);
const INTEREST_MATCH_FOLLOW_RATE = getConfig('browsingPatterns.interestMatchFollowRate', 0.7);
const RANDOM_EXPLORATION_RATE = getConfig('browsingPatterns.randomExplorationRate', 0.3);
const DISTRACTION_RATE = getConfig('browsingPatterns.distractionRate', 0.15);
const COMPARISON_SHOPPING_RATE = getConfig('browsingPatterns.comparisonShoppingRate', 0.4);
const IMPULSE_BUYING_RATE = getConfig('browsingPatterns.impulseBuyingRate', 0.25);

// =============================================================================

// Import additional metrics
import { Counter, Rate } from 'k6/metrics';

// Custom trends to measure performance of specific pages
const productPageTrend = new Trend('product_page_duration', true);
const categoryPageTrend = new Trend('category_page_duration', true);
const homepageTrend = new Trend('homepage_duration', true);
const searchTrend = new Trend('search_duration', true);
const cartTrend = new Trend('cart_duration', true);
const addToCartTrend = new Trend('add_to_cart_duration', true);
const checkoutTrend = new Trend('checkout_duration', true);
const graphqlTrend = new Trend('graphql_duration', true);
const restTrend = new Trend('rest_duration', true);

// (Optional metrics removed for now to keep script lean)

export const options = {
  setupTimeout: '30s', // Shorter setup timeout - don't wait too long
  stages: [
    { duration: RAMP_UP_DURATION, target: VIRTUAL_USERS }, // Ramp-up phase
    { duration: SUSTAINED_DURATION, target: VIRTUAL_USERS }, // Sustained load phase
    { duration: RAMP_DOWN_DURATION, target: 0 }, // Ramp-down phase
  ],
  thresholds: {
    'http_req_failed': [`rate<${HTTP_ERROR_THRESHOLD}`], // HTTP error threshold
    'http_req_duration': [`p(95)<${HTTP_DURATION_THRESHOLD}`], // HTTP request duration threshold
    'product_page_duration': [`p(95)<${PRODUCT_DURATION_THRESHOLD}`], // Product page threshold
    'category_page_duration': [`p(95)<${CATEGORY_DURATION_THRESHOLD}`], // Category page threshold
    'homepage_duration': [`p(95)<${HOMEPAGE_DURATION_THRESHOLD}`], // Homepage threshold
    'search_duration': [`p(95)<${SEARCH_DURATION_THRESHOLD}`], // Search threshold
    'cart_duration': [`p(95)<${CART_DURATION_THRESHOLD}`], // Cart threshold
    'add_to_cart_duration': [`p(95)<${CART_DURATION_THRESHOLD}`], // Add to cart threshold
    'checkout_duration': [`p(95)<${CART_DURATION_THRESHOLD}`], // Checkout threshold
    'graphql_duration': [`p(95)<${HTTP_DURATION_THRESHOLD}`], // GraphQL threshold
    'rest_duration': [`p(95)<${HTTP_DURATION_THRESHOLD}`], // REST threshold
  },
  ext: {
    loadimpact: {
      projectID: 3694943,
      name: `Magento 2 Load Test - ${VIRTUAL_USERS} VUs`
    }
  }
};

// The setup function runs once before the test starts.
// It discovers real URLs from your Magento site with Medium profile data.
// Helper function to validate if a URL exists
function validateUrl(url) {
  if (!VALIDATE_URLS_BEFORE_USE) return true;
  
  try {
    const res = http.get(url, { 
      headers: { 'User-Agent': USER_AGENT },
      timeout: '5s'
    });
    return res.status >= 200 && res.status < 400;
  } catch (e) {
    return false;
  }
}

// Helper function to crawl a page and extract URLs
function crawlPage(url, depth = 0) {
  if (depth > MAX_CRAWL_DEPTH) return { products: [], categories: [], searchTerms: [] };
  
  const productUrls = [];
  const categoryUrls = [];
  const searchTerms = [];
  
  try {
    const res = http.get(url, { 
      headers: { 'User-Agent': USER_AGENT },
      timeout: '10s'
    });
    
    if (!res.body) return { products: [], categories: [], searchTerms: [] };
    
    const doc = res.html();
    
    // Extract URLs from page
    doc.find('a[href*=".html"]').each((i, el) => {
      try {
        let href = el.attr('href');
        if (!href) return;
        
        // Normalize relative URLs to absolute
        if (href.startsWith('/')) {
          href = `${BASE_URL}${href}`;
        }
        
        if (href.includes('.html') && href.startsWith(BASE_URL)) {
          // Skip excluded URLs
          if (EXCLUDED_URL_SUBSTRINGS.some(s => href.includes(s))) return;
          
          // Validate URL exists (quick check)
          if (!validateUrl(href)) return;
          
          // Categorize URLs - Enhanced pattern matching for real Magento URLs
          if (href.includes('/category') || href.includes('/women') || href.includes('/men') ||
              href.includes('/gear') || href.includes('/training') || href.includes('/electronics') ||
              href.includes('/collections') || href.includes('/training/') || href.includes('/gear/')) {
            if (categoryUrls.indexOf(href) === -1) categoryUrls.push(href);
          } else if (href.includes('.html') && !href.includes('/category') && 
                     !href.includes('/admin') && !href.includes('/checkout') && 
                     !href.includes('/customer') && !href.includes('/contact')) {
            // This is likely a product URL
            if (productUrls.indexOf(href) === -1) productUrls.push(href);
        }
        }
      } catch (e) {
        // Skip problematic elements
      }
    });
    
    // Extract search terms from text content
    doc.find('a[href*=".html"]').each((i, el) => {
      try {
        const text = el.text().trim();
        if (text && text.length > 2 && text.length < 20 && !text.includes('http')) {
          if (searchTerms.indexOf(text.toLowerCase()) === -1) {
            searchTerms.push(text.toLowerCase());
          }
        }
      } catch (e) {
        // Skip problematic elements
      }
    });
    
  } catch (e) {
    console.log(`Failed to crawl ${url}: ${e.message}`);
  }
  
  return { products: productUrls, categories: categoryUrls, searchTerms: searchTerms };
}

export function setup() {
  if (!ENABLE_URL_DISCOVERY) {
    console.log('Running setup... URL discovery disabled, using verified fallback URLs only.');
    return generateFallbackUrls();
  }

  console.log('Running setup... Discovering real URLs from your Magento site with enhanced crawling.');

  const allProductUrls = [];
  const allCategoryUrls = [];
  const allSearchTerms = [];

  // Start with homepage
  const homepageData = crawlPage(BASE_URL, 0);
  allProductUrls.push(...homepageData.products);
  allCategoryUrls.push(...homepageData.categories);
  allSearchTerms.push(...homepageData.searchTerms);

  // If deep crawling is enabled, crawl some category pages
  if (ENABLE_DEEP_CRAWLING && allCategoryUrls.length > 0) {
    console.log(`Deep crawling ${Math.min(5, allCategoryUrls.length)} category pages...`);
    
    // Crawl first few category pages to find more products
    const categoriesToCrawl = allCategoryUrls.slice(0, Math.min(5, allCategoryUrls.length));
    categoriesToCrawl.forEach(categoryUrl => {
      const categoryData = crawlPage(categoryUrl, 1);
      allProductUrls.push(...categoryData.products);
      allSearchTerms.push(...categoryData.searchTerms);
    });
  }

  // Remove duplicates
  const uniqueProducts = [...new Set(allProductUrls)];
  const uniqueCategories = [...new Set(allCategoryUrls)];
  const uniqueSearchTerms = [...new Set(allSearchTerms)];

  // Use fallback URLs if discovery found nothing or very few URLs
  if (uniqueProducts.length === 0 || uniqueCategories.length === 0) {
    console.log('Using fallback URLs due to failed discovery or empty results');
    return generateFallbackUrls();
  }

  // Use fallback search terms if none found
  const finalSearchTerms = uniqueSearchTerms.length > 0 ? uniqueSearchTerms : FALLBACK_SEARCH_TERMS;

  console.log(`Setup complete. Found ${uniqueProducts.length} product URLs, ${uniqueCategories.length} category URLs, and ${finalSearchTerms.length} search terms.`);
  
  return {
    products: limit(uniqueProducts, MAX_PRODUCTS),
    categories: limit(uniqueCategories, MAX_CATEGORIES),
    searchTerms: limit(finalSearchTerms, MAX_SEARCH_TERMS)
  };
}

// Helper function to extract CSRF token from HTML
function extractFormKey(html) {
  if (!html || typeof html !== 'string') {
    return null;
  }
  const formKeyMatch = html.match(/name="form_key"[^>]*value="([^"]+)"/);
  return formKeyMatch ? formKeyMatch[1] : null;
}

// Enhanced product info extraction with configurable product support
function extractProductInfo(html) {
  if (!html || typeof html !== 'string') {
    return {
      productId: null,
      requiresOptions: false,
      availableOptions: {}
    };
  }
  
  const idMatch = html.match(/product_id['"]\s*:\s*['"]?(\d+)['"]?/);
  const productId = idMatch ? idMatch[1] : null;
  
  // Enhanced configurable product detection
  const isConfigurable = /data-role="swatch-options"|super_attribute|configurable-data|swatch-opt/.test(html);
  
  if (isConfigurable) {
    const availableOptions = extractSwatchOptions(html);
    return {
      productId,
      requiresOptions: true,
      availableOptions
    };
  }
  
  return {
    productId,
    requiresOptions: false,
    availableOptions: {}
  };
}

// Extract swatch options for configurable products
function extractSwatchOptions(html) {
  const options = {};
  
  try {
    // Extract size options
    const sizeMatches = html.match(/attribute_id['"]\s*:\s*['"]?(\d+)['"]?.*?attribute_code['"]\s*:\s*['"]size['"].*?options['"]\s*:\s*(\{[^}]+\})/s);
    if (sizeMatches) {
      const sizeOptionsText = sizeMatches[2];
      const sizeIds = sizeOptionsText.match(/['"](\d+)['"]/g);
      if (sizeIds && sizeIds.length > 0) {
        options.size = sizeIds[Math.floor(Math.random() * sizeIds.length)].replace(/['"]/g, '');
      }
    }
    
    // Extract color options
    const colorMatches = html.match(/attribute_id['"]\s*:\s*['"]?(\d+)['"]?.*?attribute_code['"]\s*:\s*['"]color['"].*?options['"]\s*:\s*(\{[^}]+\})/s);
    if (colorMatches) {
      const colorOptionsText = colorMatches[2];
      const colorIds = colorOptionsText.match(/['"](\d+)['"]/g);
      if (colorIds && colorIds.length > 0) {
        options.color = colorIds[Math.floor(Math.random() * colorIds.length)].replace(/['"]/g, '');
      }
    }
    
    // Fallback: extract any super_attribute options
    const superAttributeMatches = html.match(/super_attribute\[(\d+)\]/g);
    if (superAttributeMatches) {
      superAttributeMatches.forEach(match => {
        const attrId = match.match(/\d+/)[0];
        // Generate random option ID (common range 1-20)
        options[`super_attribute[${attrId}]`] = Math.floor(Math.random() * 20) + 1;
      });
    }
  } catch (e) {
    // If extraction fails, return common default options
    options['super_attribute[92]'] = Math.floor(Math.random() * 5) + 1; // Size
    options['super_attribute[93]'] = Math.floor(Math.random() * 10) + 1; // Color
  }
  
  return options;
}

// Helper function to make HTTP request with retry logic
function httpGetWithRetry(url, params, maxRetries = 2) {
  let lastResponse;
  for (let i = 0; i <= maxRetries; i++) {
    lastResponse = http.get(url, params);
    if (lastResponse.status === 200) {
      return lastResponse;
    }
    if (i < maxRetries) {
      sleep(1); // Wait 1 second before retry
    }
  }
  return lastResponse;
}

// GraphQL helper
function graphqlQuery(query, variables = {}, extraHeaders = {}) {
  const res = http.post(
    `${BASE_URL}${GRAPHQL_PATH}`,
    JSON.stringify({ query, variables }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
        ...extraHeaders,
      },
    }
  );
  return res;
}

// REST helper
function restGet(path, extraHeaders = {}) {
  return http.get(`${BASE_URL}${path}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
      ...extraHeaders,
    },
  });
}

function restPost(path, body, extraHeaders = {}) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
      ...extraHeaders,
    },
  });
}

// Helper to limit array size
function limit(arr, max) {
  return max > 0 ? arr.slice(0, max) : arr;
}

// Helper to generate fallback URLs with real URLs from your site
function generateFallbackUrls() {
  const productUrls = [];
  const categoryUrls = [];
  const searchTerms = [];
  
  // Ensure arrays are properly handled
  const realProducts = Array.isArray(REAL_PRODUCT_URLS) ? REAL_PRODUCT_URLS : [];
  const realCategories = Array.isArray(FALLBACK_CATEGORY_SLUGS) ? FALLBACK_CATEGORY_SLUGS : [];
  const realSearchTerms = Array.isArray(FALLBACK_SEARCH_TERMS) ? FALLBACK_SEARCH_TERMS : [];
  
  
  // Use real product URLs from your site
  realProducts.forEach(product => {
    productUrls.push(`${BASE_URL}/${product}`);
  });
  
  // Generate fallback category URLs with real categories
  realCategories.forEach(slug => {
    categoryUrls.push(`${BASE_URL}/${slug}.html`);
  });
  
  // Add search terms
  searchTerms.push(...realSearchTerms);
  
  console.log(`Fallback URLs generated: ${productUrls.length} products, ${categoryUrls.length} categories, ${searchTerms.length} search terms`);
  
  return { 
    products: limit(productUrls, MAX_PRODUCTS),
    categories: limit(categoryUrls, MAX_CATEGORIES),
    searchTerms: limit(searchTerms, MAX_SEARCH_TERMS)
  };
}

// Helper to determine if request should bypass cache
function shouldBypassCache() {
  return ENABLE_CACHE_BYPASS && Math.random() < CACHE_BYPASS_PERCENTAGE;
}

// Helper to get HTTP request parameters with optional cache bypass
function getHttpParams(bypassCache = false) {
  const baseParams = {
    timeout: HTTP_TIMEOUT,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': ACCEPT_LANGUAGE,
      'Cache-Control': 'no-cache',
    },
  };

  if (bypassCache) {
    baseParams.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    baseParams.headers['Pragma'] = 'no-cache';
    baseParams.headers['Expires'] = '0';
  }

  return baseParams;
}

// Enhanced Real User Session with proper session management
class RealUserSession {
  constructor(params) {
    this.params = params;
    this.discoveredCategories = [];
    this.discoveredProducts = [];
    this.discoveredRelatedProducts = []; // Products found via "related" links
    this.discoveredPagination = []; // Pagination URLs
    this.discoveredBreadcrumbs = []; // Navigation breadcrumbs
    this.visitedPages = [];
    this.navigationPath = []; // Track user's navigation journey
    this.cart = [];
    this.interests = this.generateUserInterests();
    this.shoppingIntent = Math.random(); // 0-1, higher = more likely to buy
    this.sessionStartTime = Date.now();
    this.formKey = null;
    this.cookieJar = http.cookieJar(); // Proper cookie management
    this.sessionId = null;
    this.customerId = null;
    this.isLoggedIn = false;
    this.isMobileUser = Math.random() < 0.4; // 40% mobile users
    this.currentContext = 'homepage'; // Track where user is in their journey
    this.cartId = null; // For GraphQL cart operations
    
    // Mobile users have different behavior
    if (this.isMobileUser) {
      this.params.headers['User-Agent'] = this.getMobileUserAgent();
      this.maxBrowsingActions = Math.floor(MAX_BROWSING_ACTIONS * 0.7); // Shorter sessions
      this.thinkTimeMultiplier = 0.8; // Faster browsing
    } else {
      this.maxBrowsingActions = MAX_BROWSING_ACTIONS;
      this.thinkTimeMultiplier = 1.0;
    }
  }

  // Get mobile user agent
  getMobileUserAgent() {
    const mobileAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    ];
    return mobileAgents[Math.floor(Math.random() * mobileAgents.length)];
  }

  // Update session cookies from response
  updateSessionCookies(response) {
    if (response.headers && response.headers['Set-Cookie']) {
      const cookies = response.headers['Set-Cookie'];
      if (Array.isArray(cookies)) {
        cookies.forEach(cookie => {
          if (cookie.includes('PHPSESSID')) {
            this.sessionId = cookie.match(/PHPSESSID=([^;]+)/)?.[1];
          }
        });
      } else if (typeof cookies === 'string' && cookies.includes('PHPSESSID')) {
        this.sessionId = cookies.match(/PHPSESSID=([^;]+)/)?.[1];
      }
    }
  }

  // Generate realistic user interests/preferences
  generateUserInterests() {
    const allInterests = ['clothing', 'gear', 'fitness', 'electronics', 'accessories', 'training', 'yoga'];
    const numInterests = Math.floor(Math.random() * 3) + 1; // 1-3 interests
    const interests = [];
    for (let i = 0; i < numInterests; i++) {
      const interest = allInterests[Math.floor(Math.random() * allInterests.length)];
      if (!interests.includes(interest)) interests.push(interest);
    }
    return interests;
  }

  // Extract links from a page response with realistic browsing patterns
  extractLinksFromPage(res) {
    if (!res.body) return { categories: [], products: [], pagination: [], related: [], breadcrumbs: [] };
    
    const categories = [];
    const products = [];
    const pagination = [];
    const related = [];
    const breadcrumbs = [];
    
    try {
      const doc = res.html();
      
      // Extract navigation breadcrumbs (realistic user behavior)
      doc.find('.breadcrumbs a, .breadcrumb a, nav a').each((i, el) => {
        try {
          let href = el.attr('href');
          if (href && href.startsWith('/') && !breadcrumbs.includes(`${BASE_URL}${href}`)) {
            breadcrumbs.push(`${BASE_URL}${href}`);
          }
        } catch (e) {}
      });
      
      // Extract pagination links (users browse through pages)
      doc.find('a[href*="p="], a[href*="page="], .pages a, .pager a').each((i, el) => {
        try {
          let href = el.attr('href');
          if (href) {
            if (href.startsWith('/')) href = `${BASE_URL}${href}`;
            if (href.startsWith(BASE_URL) && !pagination.includes(href)) {
              pagination.push(href);
            }
          }
        } catch (e) {}
      });
      
      // Extract related/recommended products (realistic discovery)
      doc.find('.related-products a, .upsell-products a, .crosssell a, [class*="related"] a, [class*="recommend"] a').each((i, el) => {
        try {
          let href = el.attr('href');
          if (href && href.includes('.html')) {
            if (href.startsWith('/')) href = `${BASE_URL}${href}`;
            if (href.startsWith(BASE_URL) && !related.includes(href)) {
              related.push(href);
            }
          }
        } catch (e) {}
      });
      
      // Extract all product and category links
      doc.find('a[href*=".html"]').each((i, el) => {
        try {
          let href = el.attr('href');
          if (!href) return;
          
          // Normalize relative URLs
          if (href.startsWith('/')) {
            href = `${BASE_URL}${href}`;
          }
          
          if (href.includes('.html') && href.startsWith(BASE_URL)) {
            // Skip excluded URLs
            if (EXCLUDED_URL_SUBSTRINGS.some(s => href.includes(s))) return;
            
            // Check if this matches user interests
            const linkText = el.text().toLowerCase();
            const linkClass = el.attr('class') || '';
            const parentClass = el.parent().attr('class') || '';
            
            const isInteresting = this.interests.some(interest => 
              href.toLowerCase().includes(interest) || 
              linkText.includes(interest) ||
              linkClass.includes(interest) ||
              parentClass.includes(interest)
            );
            
            // Enhanced categorization with realistic user behavior
            if (href.includes('/category') || href.includes('/gear') || href.includes('/training') ||
                href.includes('/women') || href.includes('/men') || href.includes('/collections') ||
                linkClass.includes('category') || parentClass.includes('category')) {
              if (!this.discoveredCategories.includes(href) && (isInteresting || Math.random() < 0.4)) {
                categories.push(href);
              }
            } else if (!this.discoveredProducts.includes(href) && (isInteresting || Math.random() < 0.3)) {
              products.push(href);
            }
          }
        } catch (e) {
          // Skip problematic elements
        }
      });
    } catch (e) {
      // Skip HTML parsing errors
    }
    
    return { categories, products, pagination, related, breadcrumbs };
  }

  // Visit a page and extract links like a real user with session-based discovery
  visitPage(url, pageType = 'page') {
    if (this.visitedPages.includes(url)) return null; // Don't revisit same page
    
    // Track navigation path
    this.navigationPath.push({ url, pageType, timestamp: Date.now() - this.sessionStartTime });
    this.currentContext = pageType;
    
    const res = http.get(url, this.params);
    const success = res.status >= 200 && res.status < 400;
    
    if (success) {
      this.visitedPages.push(url);
      
      // Extract form key if available
      if (!this.formKey) {
        this.formKey = extractFormKey(res.body);
      }
      
      // Extract new links from this page with enhanced discovery
      const newLinks = this.extractLinksFromPage(res);
      
      // Session-based URL discovery - build user's personal navigation map
      this.updateSessionDiscovery(newLinks, pageType);
      
      return { 
        res, 
        success, 
        newLinks: newLinks 
      };
    }
    
    return { 
      res, 
      success, 
      newLinks: { categories: [], products: [], pagination: [], related: [], breadcrumbs: [] } 
    };
  }

  // Update session discovery based on page type and user behavior
  updateSessionDiscovery(newLinks, pageType) {
    // Add categories with priority based on context and interests
    newLinks.categories.forEach(cat => {
      if (!this.discoveredCategories.includes(cat)) {
        // Prioritize categories based on current context and interests
        const priority = this.calculateLinkPriority(cat, 'category');
        if (priority > 0.3) { // Only add interesting categories
          this.discoveredCategories.push(cat);
        }
      }
    });
    
    // Add products with interest-based filtering
    newLinks.products.forEach(prod => {
      if (!this.discoveredProducts.includes(prod)) {
        const priority = this.calculateLinkPriority(prod, 'product');
        if (priority > 0.2) { // Only add interesting products
          this.discoveredProducts.push(prod);
        }
      }
    });
    
    // Add related products (high priority - users often follow these)
    newLinks.related.forEach(rel => {
      if (!this.discoveredRelatedProducts.includes(rel)) {
        this.discoveredRelatedProducts.push(rel);
      }
    });
    
    // Add pagination (users browse through category pages)
    newLinks.pagination.forEach(page => {
      if (!this.discoveredPagination.includes(page)) {
        this.discoveredPagination.push(page);
      }
    });
    
    // Add breadcrumbs (users navigate back)
    newLinks.breadcrumbs.forEach(breadcrumb => {
      if (!this.discoveredBreadcrumbs.includes(breadcrumb)) {
        this.discoveredBreadcrumbs.push(breadcrumb);
      }
    });
  }

  // Calculate link priority based on user interests and context
  calculateLinkPriority(url, linkType) {
    let priority = 0.1; // Base priority
    
    // Interest matching (high priority)
    const matchesInterest = this.interests.some(interest => 
      url.toLowerCase().includes(interest)
    );
    if (matchesInterest) priority += 0.6;
    
    // Context-based priority
    if (linkType === 'category' && this.currentContext === 'homepage') {
      priority += 0.3; // Users often go to categories from homepage
    } else if (linkType === 'product' && this.currentContext === 'category') {
      priority += 0.4; // Users often go to products from categories
    } else if (linkType === 'product' && this.currentContext === 'product') {
      priority += 0.2; // Users sometimes browse related products
    }
    
    // Shopping intent affects product priority
    if (linkType === 'product') {
      priority += this.shoppingIntent * 0.3;
    }
    
    return Math.min(priority, 1.0);
  }

  // Get next URL to visit based on realistic user behavior and configuration
  getNextUrl() {
    // Real user decision making with configurable rates
    const decision = Math.random();
    
    // Follow related products if available (high engagement behavior)
    if (decision < RELATED_PRODUCT_FOLLOW_RATE && this.discoveredRelatedProducts.length > 0) {
      const relatedUrl = this.discoveredRelatedProducts[Math.floor(Math.random() * this.discoveredRelatedProducts.length)];
      return { url: relatedUrl, type: 'related_product' };
    }
    
    // Browse pagination if in category context (realistic browsing)
    if (decision < RELATED_PRODUCT_FOLLOW_RATE + PAGINATION_FOLLOW_RATE && 
        (this.currentContext === 'category' || this.currentContext === 'pagination') && 
        this.discoveredPagination.length > 0) {
      const paginationUrl = this.discoveredPagination[Math.floor(Math.random() * this.discoveredPagination.length)];
      return { url: paginationUrl, type: 'pagination' };
    }
    
    // Use breadcrumbs for navigation (users navigate back)
    if (decision < RELATED_PRODUCT_FOLLOW_RATE + PAGINATION_FOLLOW_RATE + BREADCRUMB_FOLLOW_RATE && 
        this.discoveredBreadcrumbs.length > 0) {
      const breadcrumbUrl = this.discoveredBreadcrumbs[Math.floor(Math.random() * this.discoveredBreadcrumbs.length)];
      return { url: breadcrumbUrl, type: 'breadcrumb' };
    }
    
    // Prioritize categories and products for catalog traffic
    const catalogPriority = Math.random();
    
    // 85% chance to explore categories (heavily increased for more catalog/category/view)
    if (catalogPriority < 0.85 && this.discoveredCategories.length > 0) {
      // Prefer categories matching interests
      const interestedCategories = this.discoveredCategories.filter(cat =>
        this.interests.some(interest => cat.toLowerCase().includes(interest))
      );
      
      let categoryPool;
      if (interestedCategories.length > 0 && Math.random() < INTEREST_MATCH_FOLLOW_RATE) {
        categoryPool = interestedCategories; // Follow interests
      } else {
        categoryPool = this.discoveredCategories; // Always explore categories
      }
      
      const categoryUrl = categoryPool[Math.floor(Math.random() * categoryPool.length)];
      return { url: categoryUrl, type: 'category' };
    }
    
    // 15% chance to explore products (but still significant for catalog/product/view)
    if (this.discoveredProducts.length > 0) {
      const productUrl = this.discoveredProducts[Math.floor(Math.random() * this.discoveredProducts.length)];
      return { url: productUrl, type: 'product' };
    }
    
    return null; // No more URLs to explore
  }

  // Enhanced add to cart with configurable product support
  addToCart(productId, availableOptions = {}) {
    if (!this.formKey || !productId) return false;
    
    const addToCartParams = {
      ...this.params,
      headers: {
        ...this.params.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
    };

    const qty = Math.floor(Math.random() * (ADD_TO_CART_MAX_QTY - ADD_TO_CART_MIN_QTY + 1)) + ADD_TO_CART_MIN_QTY;
    const addToCartData = {
      'product': productId,
      'form_key': this.formKey,
      'qty': qty,
      ...availableOptions // Include selected options for configurable products
    };

    const addToCartRes = http.post(`${BASE_URL}${ADD_TO_CART_PATH}`, addToCartData, addToCartParams);
    const success = addToCartRes.status >= 200 && addToCartRes.status < 400;
    
    if (success) {
      this.cart.push({ productId, qty, options: availableOptions });
      addToCartTrend.add(addToCartRes.timings.duration);
      this.updateSessionCookies(addToCartRes);
    }
    
    return success;
  }

  // Enhanced cart management with modifications
  modifyCart() {
    if (this.cart.length === 0) return false;
    
    const action = Math.random();
    
    if (action < 0.4) {
      // Update quantities (40% chance)
      return this.updateCartQuantities();
    } else if (action < 0.6) {
      // Remove items (20% chance)
      return this.removeCartItems();
    } else if (action < 0.8) {
      // Apply coupon (20% chance)
      return this.applyCouponCode();
    }
    
    return false;
  }

  // Update cart quantities
  updateCartQuantities() {
    if (this.cart.length === 0) return false;
    
    // Simulate updating quantity for a random item
    const cartItem = this.cart[Math.floor(Math.random() * this.cart.length)];
    const newQty = Math.floor(Math.random() * 3) + 1;
    
    const updateParams = {
      ...this.params,
      headers: {
        ...this.params.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const updateData = {
      'form_key': this.formKey,
      [`cart[${cartItem.productId}][qty]`]: newQty,
      'update_cart_action': 'update_qty'
    };

    const updateRes = http.post(`${BASE_URL}${CART_PAGE_PATH}`, updateData, updateParams);
    const success = updateRes.status >= 200 && updateRes.status < 400;
    
    if (success) {
      cartItem.qty = newQty;
      cartTrend.add(updateRes.timings.duration);
    }
    
    return success;
  }

  // Remove items from cart
  removeCartItems() {
    if (this.cart.length === 0) return false;
    
    // Remove a random item
    const itemIndex = Math.floor(Math.random() * this.cart.length);
    const cartItem = this.cart[itemIndex];
    
    const removeParams = {
      ...this.params,
      headers: {
        ...this.params.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const removeData = {
      'form_key': this.formKey,
      [`cart[${cartItem.productId}][qty]`]: 0,
      'update_cart_action': 'update_qty'
    };

    const removeRes = http.post(`${BASE_URL}${CART_PAGE_PATH}`, removeData, removeParams);
    const success = removeRes.status >= 200 && removeRes.status < 400;
    
    if (success) {
      this.cart.splice(itemIndex, 1);
      cartTrend.add(removeRes.timings.duration);
    }
    
    return success;
  }

  // Apply coupon code
  applyCouponCode() {
    const commonCoupons = ['SAVE10', 'WELCOME', 'FIRST20', 'DISCOUNT', 'SALE'];
    const couponCode = commonCoupons[Math.floor(Math.random() * commonCoupons.length)];
    
    const couponParams = {
      ...this.params,
      headers: {
        ...this.params.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const couponData = {
      'form_key': this.formKey,
      'coupon_code': couponCode,
      'apply_coupon': 'Apply Coupon'
    };

    const couponRes = http.post(`${BASE_URL}${CART_PAGE_PATH}`, couponData, couponParams);
    const success = couponRes.status >= 200 && couponRes.status < 400;
    
    if (success) {
      cartTrend.add(couponRes.timings.duration);
    }
    
    return success;
  }
}

// The default function is the main loop for each virtual user.
export default function (data) {
  // Create a real user session for this virtual user
  const bypassCache = shouldBypassCache();
  const params = getHttpParams(bypassCache);
  const user = new RealUserSession(params);

  // Simulate real user behavior with dynamic discovery
  realUserBrowsingSession(user, data);
}

// Real User Browsing Session - simulates how actual users browse e-commerce sites
function realUserBrowsingSession(user, fallbackData) {
  group('Real User Browsing Session', function () {
    // PHASE 1: Start at homepage and discover initial links
    group('Visit Homepage & Discover Links', function () {
      const homepageResult = user.visitPage(BASE_URL, 'homepage');
      if (homepageResult && homepageResult.success) {
        check(homepageResult.res, { 'Homepage status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        homepageTrend.add(homepageResult.res.timings.duration);
      }
    });

    sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

    // PHASE 2: Dynamic browsing based on discovered links and user behavior
    const maxBrowsingActions = Math.floor(Math.random() * (MAX_BROWSING_ACTIONS - MIN_BROWSING_ACTIONS + 1)) + MIN_BROWSING_ACTIONS;
    let browsingActions = 0;
    
    while (browsingActions < maxBrowsingActions) {
      // Get next URL based on realistic user behavior patterns
      let nextNavigation = user.getNextUrl();
      
      // Fallback to predefined URLs - heavily prioritize categories over products
      if (!nextNavigation) {
        // 90% chance to use categories for maximum catalog/category/view traffic
        if (fallbackData.categories && fallbackData.categories.length > 0 && Math.random() < 0.9) {
          const categoryUrl = fallbackData.categories[Math.floor(Math.random() * fallbackData.categories.length)];
          nextNavigation = { url: categoryUrl, type: 'category' };
        } else if (fallbackData.products && fallbackData.products.length > 0) {
          const productUrl = fallbackData.products[Math.floor(Math.random() * fallbackData.products.length)];
          nextNavigation = { url: productUrl, type: 'product' };
        }
      }
      
      if (!nextNavigation) break; // No more URLs to explore
      
      browsingActions++;
      const actionType = nextNavigation.type;
      const actionUrl = nextNavigation.url;
      
      group(`Browse ${actionType} (Action ${browsingActions})`, function () {
        const result = user.visitPage(actionUrl, actionType);
        if (result && result.success) {
          // Track metrics based on page type
          if (actionType === 'category' || actionType === 'pagination') {
            check(result.res, { 'Category/List page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            categoryPageTrend.add(result.res.timings.duration);
          } else if (actionType === 'product' || actionType === 'related_product') {
            check(result.res, { 'Product page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            productPageTrend.add(result.res.timings.duration);
            
            // Enhanced product decision with configurable product support
            const { productId, requiresOptions, availableOptions } = extractProductInfo(result.res.body);
            let addToCartChance = 0.5; // Base chance for more cart activity
            
            // Increase chance based on context
            if (actionType === 'related_product') addToCartChance += 0.3; // Related products are more appealing
            if (user.shoppingIntent > 0.5) addToCartChance += 0.3; // Lower threshold for high intent
            if (user.cart.length === 0) addToCartChance += 0.4; // Higher first item bonus
            if (user.interests.some(interest => result.res.url.toLowerCase().includes(interest))) {
              addToCartChance += 0.2; // Interest match bonus
            }
            
            // Support both simple and configurable products
            const shouldAddToCart = Math.random() < Math.min(addToCartChance, 0.9) && 
                                   productId && 
                                   user.cart.length < MAX_PRODUCTS_IN_CART;

            if (shouldAddToCart) {
              sleep(Math.random() * 2 + 1); // Think time for product selection

              group('Add Product to Cart', function () {
                let addSuccess;
                if (requiresOptions && Object.keys(availableOptions).length > 0) {
                  // Configurable product - use extracted options
                  addSuccess = user.addToCart(productId, availableOptions);
                  check({ status: addSuccess ? 200 : 400 }, { 'Add configurable product to cart': () => addSuccess });
                } else {
                  // Simple product
                  addSuccess = user.addToCart(productId);
                  check({ status: addSuccess ? 200 : 400 }, { 'Add simple product to cart': () => addSuccess });
                }
                
                // Immediately check cart after adding (realistic user behavior)
                if (addSuccess && Math.random() < 0.6) {
                  sleep(Math.random() * 1 + 1);
                  group('Check Cart After Adding', function () {
                    const cartResult = user.visitPage(`${BASE_URL}${CART_PAGE_PATH}`, 'cart');
                    if (cartResult && cartResult.success) {
                      check(cartResult.res, { 'Cart check status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
                      cartTrend.add(cartResult.res.timings.duration);
                      user.updateSessionCookies(cartResult.res);
                    }
                  });
                }
              });
            }
          } else if (actionType === 'breadcrumb') {
            check(result.res, { 'Navigation page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            // Could be homepage, category, or other navigation page
            if (result.res.url.includes('/category') || result.res.url.includes('/gear') || result.res.url.includes('/training')) {
              categoryPageTrend.add(result.res.timings.duration);
            } else {
              homepageTrend.add(result.res.timings.duration);
            }
          }
        }
      });

      // Realistic think time based on page type
      let thinkTime = Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME;
      if (actionType === 'product' || actionType === 'related_product') {
        thinkTime += Math.random() * 2; // Longer time on product pages
      } else if (actionType === 'pagination') {
        thinkTime *= 0.7; // Faster pagination browsing
      }
      
      sleep(thinkTime);
      
      // Real user behavior: sometimes get distracted and explore different areas
      if (Math.random() < DISTRACTION_RATE) {
        sleep(Math.random() * 2 + 1); // Extra think time when changing focus
        
        // When distracted, users might follow impulse buying behavior
        if (Math.random() < IMPULSE_BUYING_RATE && user.discoveredProducts.length > 0) {
          const impulseProduct = user.discoveredProducts[Math.floor(Math.random() * user.discoveredProducts.length)];
          group('Impulse Product View', function () {
            const impulseResult = user.visitPage(impulseProduct, 'product');
            if (impulseResult && impulseResult.success) {
              productPageTrend.add(impulseResult.res.timings.duration);
              
              // Higher chance to add impulse items to cart
              const { productId, requiresOptions } = extractProductInfo(impulseResult.res.body);
              if (Math.random() < 0.6 && productId && !requiresOptions && user.cart.length < MAX_PRODUCTS_IN_CART) {
                const addSuccess = user.addToCart(productId);
                check({ status: addSuccess ? 200 : 400 }, { 'Impulse add to cart': () => addSuccess });
              }
            }
          });
          browsingActions++; // Count this as a browsing action
        }
      }
    }

    // PHASE 4: Enhanced cart and checkout behavior
    if (user.cart.length > 0) {
      sleep(Math.random() * 2 + 1); // Think time before cart

      group('Visit Shopping Cart', function () {
        const cartResult = user.visitPage(`${BASE_URL}${CART_PAGE_PATH}`, 'cart');
        if (cartResult && cartResult.success) {
          check(cartResult.res, { 'Cart page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          cartTrend.add(cartResult.res.timings.duration);
          user.updateSessionCookies(cartResult.res);
        }
      });

      // Realistic cart modifications (users often change their minds)
      if (Math.random() < 0.4) {
        sleep(Math.random() * 2 + 1);
        group('Modify Cart Contents', function () {
          const modifySuccess = user.modifyCart();
          check({ status: modifySuccess ? 200 : 400 }, { 'Cart modification successful': () => modifySuccess });
        });
      }

      sleep(Math.random() * 2 + 2); // Think time in cart

      // Enhanced checkout decision
      if (Math.random() < CHECKOUT_COMPLETION_RATE) {
        group('Proceed to Checkout', function () {
          const checkoutResult = user.visitPage(`${BASE_URL}${CHECKOUT_PAGE_PATH}`, 'checkout');
          if (checkoutResult && checkoutResult.success) {
            check(checkoutResult.res, { 'Checkout page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            checkoutTrend.add(checkoutResult.res.timings.duration);
            user.updateSessionCookies(checkoutResult.res);
          }
        });
      }
    } else {
      // Even users without cart items sometimes visit cart (realistic behavior)
      if (Math.random() < 0.2) {
        group('Visit Empty Cart', function () {
          const cartResult = user.visitPage(`${BASE_URL}${CART_PAGE_PATH}`, 'cart');
          if (cartResult && cartResult.success) {
            check(cartResult.res, { 'Empty cart status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            cartTrend.add(cartResult.res.timings.duration);
            user.updateSessionCookies(cartResult.res);
          }
        });
      }
    }

    // PHASE 5: API interactions (simulating modern frontend behavior)
    if (ENABLE_API_LOAD && Math.random() < API_TRAFFIC_PERCENTAGE) {
      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
      
      group('API Interactions', function () {
        if (ENABLE_GRAPHQL_LOAD) {
          // Enhanced GraphQL operations based on user context
          const apiAction = Math.random();
          
          if (apiAction < 0.4 && user.interests.length > 0) {
            // Product search with filters
            const searchTerm = user.interests[Math.floor(Math.random() * user.interests.length)];
            const q = `query($search: String!, $pageSize: Int!) {
              products(search: $search, pageSize: $pageSize) {
                items { 
                  sku 
                  name 
                  price_range { 
                    minimum_price { 
                      final_price { value currency } 
                    } 
                  }
                }
                aggregations { 
                  attribute_code 
                  options { label value } 
                }
              }
            }`;
            const gRes = graphqlQuery(q, { search: searchTerm, pageSize: GRAPHQL_SEARCH_PAGE_SIZE });
            check(gRes, { 'GraphQL product search 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            graphqlTrend.add(gRes.timings.duration);
          } else if (apiAction < 0.7 && user.cart.length > 0) {
            // Cart operations via GraphQL
            const cartQuery = `query($cartId: String!) {
              cart(cart_id: $cartId) {
                total_quantity
                items { 
                  quantity 
                  product { sku name }
                }
              }
            }`;
            const cartId = user.cartId || 'guest_cart';
            const gRes = graphqlQuery(cartQuery, { cartId });
            check(gRes, { 'GraphQL cart query 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            graphqlTrend.add(gRes.timings.duration);
          } else {
            // Category/CMS content via GraphQL
            const cmsQuery = `query {
              cmsBlocks(identifiers: ["home-content"]) {
                items { title content }
              }
              storeConfig { store_name }
            }`;
            const gRes = graphqlQuery(cmsQuery, {});
            check(gRes, { 'GraphQL CMS query 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            graphqlTrend.add(gRes.timings.duration);
          }
        }
        
        if (ENABLE_REST_LOAD) {
          // Enhanced REST API operations
          const restAction = Math.random();
          
          if (restAction < 0.5) {
            // Store configuration
            const storeRes = restGet('/rest/default/V1/store/storeViews');
            if (storeRes.status !== 401 && storeRes.status !== 403) {
              check(storeRes, { 'REST store views 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            }
            restTrend.add(storeRes.timings.duration);
          } else if (restAction < 0.8 && user.cart.length > 0) {
            // Guest cart operations
            const cartRes = restPost('/rest/default/V1/guest-carts', {});
            if (cartRes.status >= 200 && cartRes.status < 400) {
              check(cartRes, { 'REST guest cart creation 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
              user.cartId = cartRes.body.replace(/"/g, '');
            }
            restTrend.add(cartRes.timings.duration);
          } else {
            // Directory services
            const dirRes = restGet('/rest/default/V1/directory/countries');
            if (dirRes.status !== 401 && dirRes.status !== 403) {
              check(dirRes, { 'REST directory 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            }
            restTrend.add(dirRes.timings.duration);
          }
        }
      });
    }

    // PHASE 6: Reduced search activity to focus on catalog browsing
    if (Math.random() < 0.1 && fallbackData.searchTerms && fallbackData.searchTerms.length > 0) {
      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
      
      group('Perform Search', function () {
        const searchTerm = fallbackData.searchTerms[Math.floor(Math.random() * fallbackData.searchTerms.length)];
        const searchUrl = `${BASE_URL}${SEARCH_RESULT_PATH_TEMPLATE.replace('{q}', encodeURIComponent(searchTerm))}`;
        const searchResult = user.visitPage(searchUrl, 'search');
        if (searchResult && searchResult.success) {
          check(searchResult.res, { 'Search page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          searchTrend.add(searchResult.res.timings.duration);
        }
      });
    }
  });
}
