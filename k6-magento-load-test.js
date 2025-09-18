/**
 * Magento Load Test Script for k6
 * 
 * This script performs comprehensive load testing on Magento websites, covering:
 * - Homepage performance
 * - Catalog/Category View (catalog/category/view)
 * - Catalog/Product View (catalog/product/view)
 * - Search functionality
 * - Cart page performance
 * 
 * USAGE:
 *   k6 run k6-magento-load-test.js
 * 
 * CONFIGURATION:
 *   All test parameters are configurable at the top of this file.
 *   Simply modify the values below to adjust your load test.
 * 
 * COMMON SCENARIOS:
 *   Light Load:    VIRTUAL_USERS = 10,  SUSTAINED_DURATION = '1m'
 *   Medium Load:   VIRTUAL_USERS = 20,  SUSTAINED_DURATION = '2m'  (default)
 *   Heavy Load:    VIRTUAL_USERS = 50,  SUSTAINED_DURATION = '3m'
 *   Stress Test:   VIRTUAL_USERS = 100, SUSTAINED_DURATION = '5m'
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

// =============================================================================
// LOAD TEST CONFIGURATION - Adjust these parameters to tune your test
// =============================================================================

// Target website
const BASE_URL = 'https://4kxkvuyyo22dm.dummycachetest.com';

// Load test parameters - Heavy load testing
const VIRTUAL_USERS = 500;                     // Number of concurrent virtual users (heavy load)
const RAMP_UP_DURATION = '60s';              // Time to ramp up to target users
const SUSTAINED_DURATION = '5m';             // Time to maintain target load
const RAMP_DOWN_DURATION = '60s';           // Time to ramp down to 0 users

// HTTP timeout configuration for heavy load
const HTTP_TIMEOUT = '60s';                   // HTTP request timeout (60 seconds for heavy load)

// Performance thresholds (in milliseconds) - Adjusted for heavy load testing
const HTTP_ERROR_THRESHOLD = 0.25;           // Max HTTP error rate (25% - expected under heavy load)
const HTTP_DURATION_THRESHOLD = 60000;       // Max HTTP request duration (60s - heavy load)
const HOMEPAGE_DURATION_THRESHOLD = 45000;   // Max homepage response time (45s - heavy load)
const PRODUCT_DURATION_THRESHOLD = 50000;     // Max product page response time (50s - heavy load)
const CATEGORY_DURATION_THRESHOLD = 50000;    // Max category page response time (50s - heavy load)
const SEARCH_DURATION_THRESHOLD = 45000;     // Max search response time (45s - heavy load)
const CART_DURATION_THRESHOLD = 45000;       // Max cart page response time (45s - heavy load)

// User behavior simulation
const MIN_THINK_TIME = 1;                    // Minimum think time between actions (seconds)
const MAX_THINK_TIME = 4;                    // Maximum think time between actions (seconds)
const BROWSE_JOURNEY_PERCENTAGE = 0.4;       // Percentage of users doing browse & purchase journey (40%)
const SEARCH_JOURNEY_PERCENTAGE = 0.25;      // Percentage of users doing search & purchase journey (25%)
const CART_JOURNEY_PERCENTAGE = 0.15;        // Percentage of users doing cart abandonment journey (15%)
const WINDOW_SHOPPING_PERCENTAGE = 0.15;     // Percentage of users just browsing without buying (15%)
const QUICK_BUYER_PERCENTAGE = 0.05;         // Percentage of users who buy immediately (5%)

// HTTP headers
const USER_AGENT = 'k6-load-test/1.0 (https://k6.io)';
const ACCEPT_LANGUAGE = 'en-US,en;q=0.5';

// Limits for discovered data (set to 0 for no limit)
const MAX_PRODUCTS = 500;                    // Max product URLs to use
const MAX_CATEGORIES = 50;                   // Max category URLs to use
const MAX_SEARCH_TERMS = 20;                 // Max search terms to use

// URL discovery behavior
const EXCLUDED_URL_SUBSTRINGS = ['/admin', '/checkout', '/customer', '/catalogsearch', '/contact', '/privacy', '/terms'];
const ENABLE_URL_DISCOVERY = false;          // Skip URL discovery for heavy load (use fallbacks only)
const ENABLE_FALLBACK_URLS = true;           // If discovery finds none, use fallbacks
const FALLBACK_PRODUCT_COUNT = 50;           // Number of fallback products to synthesize if enabled
const FALLBACK_CATEGORY_SLUGS = ['women', 'men', 'gear', 'training', 'electronics', 'bags', 'watches', 'fitness-equipment', 'books', 'video'];
const FALLBACK_SEARCH_TERMS = ['shirt', 'pants', 'shoes', 'bag', 'watch', 'dress', 'jacket', 'hat', 'belt', 'socks'];
const DEFAULT_SEARCH_TERM = 'shirt';

// Add-to-cart quantities
const ADD_TO_CART_MIN_QTY = 1;
const ADD_TO_CART_MAX_QTY = 15;

// Storefront paths
const CART_PAGE_PATH = '/checkout/cart/';
const CHECKOUT_PAGE_PATH = '/checkout/onepage/';
const ADD_TO_CART_PATH = '/checkout/cart/add/';
const SEARCH_RESULT_PATH_TEMPLATE = '/catalogsearch/result/?q={q}';

// API traffic configuration
const ENABLE_API_LOAD = true;                 // Enable API (REST/GraphQL) traffic
const ENABLE_GRAPHQL_LOAD = true;             // Enable GraphQL calls
const ENABLE_REST_LOAD = true;                // Enable REST calls
const API_TRAFFIC_PERCENTAGE = 0.3;           // Fraction of iterations that include API traffic (e.g., 0.2 = 20%)

// GraphQL config
const GRAPHQL_PATH = '/graphql';
const GRAPHQL_SEARCH_PAGE_SIZE = 5;

// REST config
const REST_STORE_CODE = 'default';
const REST_API_PREFIX = `/rest/${REST_STORE_CODE}/V1`;
const REST_ENDPOINTS_BROWSE = [`${REST_API_PREFIX}/store/storeViews`];
const REST_ENDPOINTS_CART = [`${REST_API_PREFIX}/directory/countries`];

// Cache bypass configuration
const CACHE_BYPASS_PERCENTAGE = 0.1;            // Percentage of requests that bypass cache (1% = 0.01)
const ENABLE_CACHE_BYPASS = true;                // Enable cache bypass functionality

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
export function setup() {
  if (!ENABLE_URL_DISCOVERY) {
    console.log('Running setup... URL discovery disabled, using fallback URLs only.');
    return generateFallbackUrls();
  }
  
  console.log('Running setup... Discovering real URLs from your Magento site.');
  
  const params = { 
    headers: { 'User-Agent': USER_AGENT },
    timeout: '10s' // Short timeout for setup
  };
  
  let res;
  try {
    res = http.get(BASE_URL, params);
    check(res, { 'Homepage loaded successfully': (r) => r.status >= 200 && r.status < 400 });
  } catch (error) {
    console.log('Setup: Homepage request failed or timed out, using fallback URLs only');
    res = null;
  }

  const productUrls = [];
  const categoryUrls = [];
  const searchTerms = [];

  if (res && res.body) {
    try {
      const doc = res.html();
      
      // Extract real product URLs from homepage (support absolute and relative hrefs)
      doc.find('a[href*=".html"]').each((i, el) => {
        try {
          let href = el.attr('href');
          if (!href) return;
          // Normalize relative URLs to absolute
          if (href.startsWith('/')) {
            href = `${BASE_URL}${href}`;
          }
          if (href.includes('.html') && href.startsWith(BASE_URL)) {
            // Skip admin, checkout, and other non-catalog URLs
            if (!EXCLUDED_URL_SUBSTRINGS.some(s => href.includes(s))) {
              
              // Categorize URLs based on common Magento patterns
              if (href.includes('/category') || href.includes('/women') || href.includes('/men') || 
                  href.includes('/gear') || href.includes('/training') || href.includes('/electronics')) {
                if (categoryUrls.indexOf(href) === -1) categoryUrls.push(href);
              } else {
                if (productUrls.indexOf(href) === -1) productUrls.push(href);
              }
            }
          }
        } catch (e) {
          // Skip problematic elements
        }
      });

      // Extract search terms from product names and categories
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
      console.log('HTML parsing failed, using fallback URLs');
    }
  } else {
    console.log('No homepage response received, using fallback URLs only');
  }

  // Use fallback URLs if discovery failed or found nothing
  if (ENABLE_FALLBACK_URLS && (productUrls.length === 0 || categoryUrls.length === 0 || searchTerms.length === 0)) {
    console.log('Using fallback URLs due to failed discovery or empty results');
    return generateFallbackUrls();
  }

  console.log(`Setup complete. Found ${productUrls.length} product URLs, ${categoryUrls.length} category URLs, and ${searchTerms.length} search terms.`);
  return { 
    products: limit(productUrls, MAX_PRODUCTS),
    categories: limit(categoryUrls, MAX_CATEGORIES),
    searchTerms: limit(searchTerms, MAX_SEARCH_TERMS)
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

// Helper to generate fallback URLs
function generateFallbackUrls() {
  const productUrls = [];
  const categoryUrls = [];
  const searchTerms = [...FALLBACK_SEARCH_TERMS];
  
  // Generate fallback product URLs
  for (let i = 1; i <= FALLBACK_PRODUCT_COUNT; i++) {
    productUrls.push(`${BASE_URL}/simple-product-${i}.html`);
    productUrls.push(`${BASE_URL}/configurable-product-${i}.html`);
  }
  
  // Generate fallback category URLs
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
  // Determine if this request should bypass cache
  const bypassCache = shouldBypassCache();
  const params = getHttpParams(bypassCache);

  // Randomly choose a user journey based on configurable percentages
  const userJourney = Math.random();
  const includeApi = ENABLE_API_LOAD && Math.random() < API_TRAFFIC_PERCENTAGE;
  
  if (userJourney < BROWSE_JOURNEY_PERCENTAGE) {
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
  } else if (userJourney < BROWSE_JOURNEY_PERCENTAGE + SEARCH_JOURNEY_PERCENTAGE) {
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
  } else {
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
  }

  sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time
}