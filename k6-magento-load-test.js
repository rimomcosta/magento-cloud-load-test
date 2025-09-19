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
 *   - Override any setting by creating 'load-test-config.json' in the same directory
 *   - All test parameters can be customized via the config file
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

// Load configuration from file if available
let config = {};
try {
  const configFile = open('./load-test-config.json');
  config = JSON.parse(configFile);
  console.log('✅ Loaded configuration from load-test-config.json');
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

// Real URLs from configuration
const FALLBACK_CATEGORY_SLUGS = getConfig('realUrls.fallbackCategorySlugs', ['category-4', 'category-5', 'gear', 'training', 'collections/yoga-new']);
const REAL_PRODUCT_URLS = getConfig('realUrls.realProductUrls', [
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
]);
const FALLBACK_SEARCH_TERMS = getConfig('realUrls.fallbackSearchTerms', ['shirt', 'pants', 'shoes', 'bag', 'watch', 'dress', 'jacket', 'hat', 'belt', 'socks']);
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
    console.log('Running setup... URL discovery disabled.');
    return { products: [], categories: [], searchTerms: FALLBACK_SEARCH_TERMS };
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

// Helper function to extract product ID and whether options are required
function extractProductInfo(html) {
  if (!html || typeof html !== 'string') {
    return {
      productId: null,
      requiresOptions: false,
    };
  }
  const idMatch = html.match(/product_id['"]\s*:\s*['"]?(\d+)['"]?/);
  const requiresOptions = /super_attribute|configurable|bundle-options|swatch-opt/.test(html);
  return {
    productId: idMatch ? idMatch[1] : null,
    requiresOptions,
  };
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
  const searchTerms = [...FALLBACK_SEARCH_TERMS];
  
  // Use real product URLs from your site
  REAL_PRODUCT_URLS.forEach(product => {
    productUrls.push(`${BASE_URL}/${product}`);
  });
  
  // Generate fallback category URLs with real categories
  FALLBACK_CATEGORY_SLUGS.forEach(slug => {
    categoryUrls.push(`${BASE_URL}/${slug}.html`);
  });
  
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

// The default function is the main loop for each virtual user.
export default function (data) {
  // Skip if no URLs were discovered (prevents 404s)
  if (!data.products || data.products.length === 0) {
    console.log('No product URLs available, skipping this iteration');
    return;
  }
  
  if (!data.categories || data.categories.length === 0) {
    console.log('No category URLs available, skipping this iteration');
    return;
  }

  // Determine if this request should bypass cache
  const bypassCache = shouldBypassCache();
  const params = getHttpParams(bypassCache);

  // Randomly choose a user journey based on configurable percentages
  const userJourney = Math.random();
  const includeApi = ENABLE_API_LOAD && Math.random() < API_TRAFFIC_PERCENTAGE;
  
  if (userJourney < COMPREHENSIVE_SHOPPING_PERCENTAGE) {
    // NEW: Comprehensive Shopping Journey - Multi-category browsing with product comparison
    comprehensiveShoppingJourney(data, params, includeApi);
  } else if (userJourney < COMPREHENSIVE_SHOPPING_PERCENTAGE + BROWSE_JOURNEY_PERCENTAGE) {
    // Browse journey: Homepage -> Category -> Product -> Add to Cart
    group('Browse & Purchase Journey', function () {
      // Visit homepage
      group('Visit Homepage', function () {
        const res = http.get(BASE_URL, params);
        check(res, { 'Homepage status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        homepageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

      // Visit category page
  group('Visit Category Page (catalog/category/view)', function () {
    const categoryUrl = data.categories[Math.floor(Math.random() * data.categories.length)];
    const res = http.get(categoryUrl, params);
        check(res, { 'Category page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
    categoryPageTrend.add(res.timings.duration);
  });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

      // Visit product page
      group('Visit Product Page (catalog/product/view)', function () {
        const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
        const res = http.get(productUrl, params);
        check(res, { 'Product page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        productPageTrend.add(res.timings.duration);
        
        // Extract form key and product info for add to cart
        const formKey = extractFormKey(res.body);
        const { productId, requiresOptions } = extractProductInfo(res.body);
        
        // Only attempt add-to-cart for simple products (no required options)
        if (formKey && productId && !requiresOptions) {
          sleep(Math.random() * 2 + 1); // Think time before adding to cart
          
          // Add to cart
          group('Add to Cart', function () {
            const addToCartParams = {
              ...params,
              headers: {
                ...params.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
              },
            };
            
            const addToCartData = {
              'product': productId,
              'form_key': formKey,
              'qty': Math.floor(Math.random() * 3) + 1, // Random quantity 1-3
            };
            
            const addToCartRes = http.post(`${BASE_URL}${ADD_TO_CART_PATH}`, addToCartData, addToCartParams);
            check(addToCartRes, { 'Add to cart status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            addToCartTrend.add(addToCartRes.timings.duration);
          });
          
          sleep(Math.random() * 2 + 1); // Think time after adding to cart
          
          // Visit cart page
          group('Visit Cart Page', function () {
            const cartUrl = `${BASE_URL}${CART_PAGE_PATH}`;
            const res = http.get(cartUrl, params);
            check(res, { 'Cart page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            cartTrend.add(res.timings.duration);
          });
        }
      });
      
      if (includeApi) {
        sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
        group('API Load - Browse Journey', function () {
          if (ENABLE_GRAPHQL_LOAD) {
            const q = `query ($search: String!){ products(search: $search, pageSize: 3){ items { sku name } } }`;
            const gRes = graphqlQuery(q, { search: data.searchTerms[0] || 'shirt' });
            check(gRes, { 'GraphQL 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            graphqlTrend.add(gRes.timings.duration);
          }
          if (ENABLE_REST_LOAD) {
            const r1 = restGet('/rest/default/V1/store/storeViews');
            if (r1.status !== 401 && r1.status !== 403) {
              check(r1, { 'REST storeViews 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            }
            restTrend.add(r1.timings.duration);
          }
        });
      }
    });
  } else if (userJourney < COMPREHENSIVE_SHOPPING_PERCENTAGE + BROWSE_JOURNEY_PERCENTAGE + SEARCH_JOURNEY_PERCENTAGE) {
    // Search journey: Homepage -> Search -> Product -> Add to Cart
    group('Search & Purchase Journey', function () {
      // Visit homepage
      group('Visit Homepage', function () {
        const res = http.get(BASE_URL, params);
        check(res, { 'Homepage status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        homepageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

      // Perform search
      group('Perform Search', function () {
        const searchTerm = data.searchTerms[Math.floor(Math.random() * data.searchTerms.length)];
        const searchUrl = `${BASE_URL}${SEARCH_RESULT_PATH_TEMPLATE.replace('{q}', encodeURIComponent(searchTerm))}`;
        const res = http.get(searchUrl, params);
        check(res, { 'Search page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        searchTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

      // Visit a product from search results (simulate clicking on a search result)
      group('Visit Product from Search', function () {
        const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
        const res = http.get(productUrl, params);
        check(res, { 'Product page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        productPageTrend.add(res.timings.duration);
        
        // Extract form key and product info for add to cart
        const formKey = extractFormKey(res.body);
        const { productId, requiresOptions } = extractProductInfo(res.body);
        
        if (formKey && productId && !requiresOptions) {
          sleep(Math.random() * 2 + 1); // Think time before adding to cart
          
          // Add to cart
          group('Add to Cart from Search', function () {
            const addToCartParams = {
              ...params,
              headers: {
                ...params.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
              },
            };
            
            const addToCartData = {
              'product': productId,
              'form_key': formKey,
              'qty': Math.floor(Math.random() * 2) + 1, // Random quantity 1-2
            };
            
            const addToCartRes = http.post(`${BASE_URL}${ADD_TO_CART_PATH}`, addToCartData, addToCartParams);
            check(addToCartRes, { 'Add to cart status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            addToCartTrend.add(addToCartRes.timings.duration);
          });
        }
      });

      if (includeApi) {
        sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
        group('API Load - Search Journey', function () {
          if (ENABLE_GRAPHQL_LOAD) {
            const q = `query ($search: String!){ products(search: $search, pageSize: 1){ items { sku } } }`;
            const gRes = graphqlQuery(q, { search: data.searchTerms[1] || 'bag' });
            if (gRes.status >= 200 && gRes.status < 400) {
              check(gRes, { 'GraphQL 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
              graphqlTrend.add(gRes.timings.duration);
              try {
                const payload = JSON.parse(gRes.body);
                const sku = payload && payload.data && payload.data.products && payload.data.products.items && payload.data.products.items[0] && payload.data.products.items[0].sku;
                if (sku && ENABLE_REST_LOAD) {
                  const cartIdRes = restPost('/rest/default/V1/guest-carts', {});
                  if (cartIdRes.status >= 200 && cartIdRes.status < 400) {
                    restTrend.add(cartIdRes.timings.duration);
                    const cartId = cartIdRes.body.replace(/"/g, '');
                    const addItemRes = restPost(`/rest/default/V1/guest-carts/${cartId}/items`, { cartItem: { quote_id: cartId, sku, qty: 1 } });
                    if (addItemRes.status !== 401 && addItemRes.status !== 403) {
                      check(addItemRes, { 'REST add item 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
                    }
                    restTrend.add(addItemRes.timings.duration);
                  }
                }
              } catch (_) {
                // ignore parse issues
              }
            }
          }
        });
      }
    });
  } else if (userJourney < COMPREHENSIVE_SHOPPING_PERCENTAGE + BROWSE_JOURNEY_PERCENTAGE + SEARCH_JOURNEY_PERCENTAGE + CART_JOURNEY_PERCENTAGE) {
    // Cart abandonment journey: Homepage -> Product -> Add to Cart -> Cart -> Abandon
    group('Cart Abandonment Journey', function () {
      // Visit homepage
      group('Visit Homepage', function () {
        const res = http.get(BASE_URL, params);
        check(res, { 'Homepage status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        homepageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

      // Visit product page
  group('Visit Product Page (catalog/product/view)', function () {
    const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
    const res = http.get(productUrl, params);
        check(res, { 'Product page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
    productPageTrend.add(res.timings.duration);
        
        // Extract form key and product info for add to cart
        const formKey = extractFormKey(res.body);
        const { productId, requiresOptions } = extractProductInfo(res.body);
        
        if (formKey && productId && !requiresOptions) {
          sleep(Math.random() * 2 + 1); // Think time before adding to cart
          
          // Add to cart
          group('Add to Cart', function () {
            const addToCartParams = {
              ...params,
              headers: {
                ...params.headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
              },
            };
            
            const addToCartData = {
              'product': productId,
              'form_key': formKey,
              'qty': Math.floor(Math.random() * 3) + 1, // Random quantity 1-3
            };
            
            const addToCartRes = http.post(`${BASE_URL}${ADD_TO_CART_PATH}`, addToCartData, addToCartParams);
            check(addToCartRes, { 'Add to cart status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            addToCartTrend.add(addToCartRes.timings.duration);
          });
          
          sleep(Math.random() * 2 + 1); // Think time after adding to cart
          
          // Visit cart page
          group('Visit Cart Page', function () {
            const cartUrl = `${BASE_URL}${CART_PAGE_PATH}`;
            const res = http.get(cartUrl, params);
            check(res, { 'Cart page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            cartTrend.add(res.timings.duration);
          });
          
          sleep(Math.random() * 3 + 2); // Longer think time before checkout
          
          // Initiate checkout (but don't complete - simulate abandonment)
          group('Initiate Checkout', function () {
            const checkoutUrl = `${BASE_URL}${CHECKOUT_PAGE_PATH}`;
            const res = http.get(checkoutUrl, params);
            check(res, { 'Checkout page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
            checkoutTrend.add(res.timings.duration);
          });
          
          if (includeApi) {
            sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
            group('API Load - Cart Journey', function () {
              if (ENABLE_REST_LOAD) {
                const countries = restGet('/rest/default/V1/directory/countries');
                if (countries.status !== 401 && countries.status !== 403) {
                  check(countries, { 'REST countries 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
                }
                restTrend.add(countries.timings.duration);
              }
            });
          }
        }
      });
    });
  } else if (userJourney < COMPREHENSIVE_SHOPPING_PERCENTAGE + BROWSE_JOURNEY_PERCENTAGE + SEARCH_JOURNEY_PERCENTAGE + CART_JOURNEY_PERCENTAGE + WINDOW_SHOPPING_PERCENTAGE) {
    // Window shopping journey: Browse multiple categories and products without purchasing
    windowShoppingJourney(data, params, includeApi);
  } else {
    // Quick buyer journey: Direct to product and purchase
    quickBuyerJourney(data, params, includeApi);
  }

  sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time
}

// =============================================================================
// ENHANCED USER JOURNEY IMPLEMENTATIONS
// =============================================================================

// Comprehensive Shopping Journey - Multi-category browsing with product comparison
function comprehensiveShoppingJourney(data, params, includeApi) {
  group('Comprehensive Shopping Journey', function () {
    const itemsInCart = [];
    let formKey = null;
    
    // Start at homepage
    group('Visit Homepage', function () {
      const res = http.get(BASE_URL, params);
      check(res, { 'Homepage status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
      homepageTrend.add(res.timings.duration);
      formKey = extractFormKey(res.body);
    });

    sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

    // Browse multiple categories
    const categoriesToVisit = Math.min(MAX_CATEGORIES_PER_SESSION, Math.floor(Math.random() * 2) + 2); // 2-3 categories
    const visitedCategories = [];

    for (let catIndex = 0; catIndex < categoriesToVisit; catIndex++) {
      const categoryUrl = data.categories[Math.floor(Math.random() * data.categories.length)];
      if (visitedCategories.includes(categoryUrl)) continue; // Skip if already visited
      visitedCategories.push(categoryUrl);

      group(`Visit Category ${catIndex + 1}`, function () {
        const res = http.get(categoryUrl, params);
        check(res, { 'Category page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        categoryPageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

      // Browse products in this category
      const productsToView = Math.min(MAX_PRODUCTS_PER_CATEGORY, Math.floor(Math.random() * 3) + 1); // 1-3 products per category
      
      for (let prodIndex = 0; prodIndex < productsToView; prodIndex++) {
        group(`View Product ${prodIndex + 1} in Category ${catIndex + 1}`, function () {
          const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
          const res = http.get(productUrl, params);
          check(res, { 'Product page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          productPageTrend.add(res.timings.duration);

          // Extract product info
          if (!formKey) formKey = extractFormKey(res.body);
          const { productId, requiresOptions } = extractProductInfo(res.body);

          // Decide whether to add to cart (not every product)
          const shouldAddToCart = Math.random() < 0.4 && formKey && productId && !requiresOptions && itemsInCart.length < MAX_PRODUCTS_IN_CART;
          
          if (shouldAddToCart) {
            sleep(Math.random() * 2 + 1); // Think time before adding to cart

            group('Add to Cart', function () {
              const addToCartParams = {
                ...params,
                headers: {
                  ...params.headers,
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'X-Requested-With': 'XMLHttpRequest',
                },
              };

              const qty = Math.floor(Math.random() * (ADD_TO_CART_MAX_QTY - ADD_TO_CART_MIN_QTY + 1)) + ADD_TO_CART_MIN_QTY;
              const addToCartData = {
                'product': productId,
                'form_key': formKey,
                'qty': qty,
              };

              const addToCartRes = http.post(`${BASE_URL}${ADD_TO_CART_PATH}`, addToCartData, addToCartParams);
              check(addToCartRes, { 'Add to cart status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
              addToCartTrend.add(addToCartRes.timings.duration);
              
              if (addToCartRes.status >= 200 && addToCartRes.status < 400) {
                itemsInCart.push({ productId, qty });
              }
            });
          }
        });

        sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
      }

      // Sometimes return to previous category (simulate comparison shopping)
      if (catIndex > 0 && Math.random() < CATEGORY_RETURN_RATE) {
        group(`Return to Previous Category`, function () {
          const previousCategoryUrl = visitedCategories[Math.floor(Math.random() * visitedCategories.length)];
          const res = http.get(previousCategoryUrl, params);
          check(res, { 'Return to category status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          categoryPageTrend.add(res.timings.duration);
        });

        sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
      }
    }

    // If items in cart, proceed to cart and potentially checkout
    if (itemsInCart.length > 0) {
      group('Visit Cart Page', function () {
        const cartUrl = `${BASE_URL}${CART_PAGE_PATH}`;
        const res = http.get(cartUrl, params);
        check(res, { 'Cart page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        cartTrend.add(res.timings.duration);
      });

      sleep(Math.random() * 3 + 2); // Longer think time in cart

      // Complete checkout based on completion rate
      if (Math.random() < CHECKOUT_COMPLETION_RATE) {
        group('Complete Checkout', function () {
          const checkoutUrl = `${BASE_URL}${CHECKOUT_PAGE_PATH}`;
          const res = http.get(checkoutUrl, params);
          check(res, { 'Checkout page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          checkoutTrend.add(res.timings.duration);
        });
      }
    }

    // Include API calls if enabled
    if (includeApi) {
      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
      group('API Load - Comprehensive Journey', function () {
        if (ENABLE_GRAPHQL_LOAD) {
          const q = `query ($search: String!){ products(search: $search, pageSize: ${GRAPHQL_SEARCH_PAGE_SIZE}){ items { sku name } } }`;
          const gRes = graphqlQuery(q, { search: data.searchTerms[0] || 'shirt' });
          check(gRes, { 'GraphQL 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          graphqlTrend.add(gRes.timings.duration);
        }
        if (ENABLE_REST_LOAD) {
          const r1 = restGet('/rest/default/V1/store/storeViews');
          if (r1.status !== 401 && r1.status !== 403) {
            check(r1, { 'REST storeViews 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          }
          restTrend.add(r1.timings.duration);
        }
      });
    }
  });
}

// Window Shopping Journey - Browse multiple categories and products without purchasing
function windowShoppingJourney(data, params, includeApi) {
  group('Window Shopping Journey', function () {
    // Start at homepage
    group('Visit Homepage', function () {
      const res = http.get(BASE_URL, params);
      check(res, { 'Homepage status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
      homepageTrend.add(res.timings.duration);
    });

    sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

    // Browse multiple categories and products without buying
    const categoriesToBrowse = Math.floor(Math.random() * 3) + 2; // 2-4 categories
    
    for (let i = 0; i < categoriesToBrowse; i++) {
      group(`Browse Category ${i + 1}`, function () {
        const categoryUrl = data.categories[Math.floor(Math.random() * data.categories.length)];
        const res = http.get(categoryUrl, params);
        check(res, { 'Category page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        categoryPageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);

      // View some products
      const productsToView = Math.floor(Math.random() * 2) + 1; // 1-2 products
      for (let j = 0; j < productsToView; j++) {
        group(`View Product ${j + 1}`, function () {
          const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
          const res = http.get(productUrl, params);
          check(res, { 'Product page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          productPageTrend.add(res.timings.duration);
        });

        sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME);
      }
    }

    // Sometimes do a search
    if (Math.random() < 0.5) {
      group('Perform Search', function () {
        const searchTerm = data.searchTerms[Math.floor(Math.random() * data.searchTerms.length)];
        const searchUrl = `${BASE_URL}${SEARCH_RESULT_PATH_TEMPLATE.replace('{q}', encodeURIComponent(searchTerm))}`;
        const res = http.get(searchUrl, params);
        check(res, { 'Search page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
        searchTrend.add(res.timings.duration);
      });
    }
  });
}

// Quick Buyer Journey - Direct to product and purchase
function quickBuyerJourney(data, params, includeApi) {
  group('Quick Buyer Journey', function () {
    // Start at homepage briefly
    group('Visit Homepage', function () {
      const res = http.get(BASE_URL, params);
      check(res, { 'Homepage status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
      homepageTrend.add(res.timings.duration);
    });

    sleep(Math.random() * 2 + 1); // Shorter think time

    // Go directly to a product
    group('Visit Product Page', function () {
      const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
      const res = http.get(productUrl, params);
      check(res, { 'Product page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
      productPageTrend.add(res.timings.duration);

      // Extract form key and product info for add to cart
      const formKey = extractFormKey(res.body);
      const { productId, requiresOptions } = extractProductInfo(res.body);

      if (formKey && productId && !requiresOptions) {
        sleep(Math.random() * 1 + 1); // Quick decision

        // Add to cart
        group('Add to Cart', function () {
          const addToCartParams = {
            ...params,
            headers: {
              ...params.headers,
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
            },
          };

          const addToCartData = {
            'product': productId,
            'form_key': formKey,
            'qty': 1, // Quick buyers usually buy just 1
          };

          const addToCartRes = http.post(`${BASE_URL}${ADD_TO_CART_PATH}`, addToCartData, addToCartParams);
          check(addToCartRes, { 'Add to cart status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          addToCartTrend.add(addToCartRes.timings.duration);
        });

        sleep(Math.random() * 1 + 1); // Quick transition

        // Go to cart
        group('Visit Cart Page', function () {
          const cartUrl = `${BASE_URL}${CART_PAGE_PATH}`;
          const res = http.get(cartUrl, params);
          check(res, { 'Cart page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          cartTrend.add(res.timings.duration);
        });

        sleep(Math.random() * 1 + 1); // Quick decision

        // Quick checkout
        group('Quick Checkout', function () {
          const checkoutUrl = `${BASE_URL}${CHECKOUT_PAGE_PATH}`;
          const res = http.get(checkoutUrl, params);
          check(res, { 'Checkout page status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
          checkoutTrend.add(res.timings.duration);
        });
      }
    });
  });
}