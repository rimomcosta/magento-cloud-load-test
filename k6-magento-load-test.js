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
import { URL } from 'https://jslib.k6.io/url/1.0.0/index.js';

// =============================================================================
// LOAD TEST CONFIGURATION - Adjust these parameters to tune your test
// =============================================================================

// Target website
const BASE_URL = 'https://4kxkvuyyo22dm.dummycachetest.com';

// Load test parameters
const VIRTUAL_USERS = 20;                    // Number of concurrent virtual users
const RAMP_UP_DURATION = '30s';              // Time to ramp up to target users
const SUSTAINED_DURATION = '2m';             // Time to maintain target load
const RAMP_DOWN_DURATION = '10s';           // Time to ramp down to 0 users

// Performance thresholds (in milliseconds)
const HTTP_ERROR_THRESHOLD = 0.05;           // Max HTTP error rate (5%)
const HTTP_DURATION_THRESHOLD = 2000;        // Max HTTP request duration (2s)
const HOMEPAGE_DURATION_THRESHOLD = 2000;    // Max homepage response time (2s)
const PRODUCT_DURATION_THRESHOLD = 3000;      // Max product page response time (3s)
const CATEGORY_DURATION_THRESHOLD = 3000;     // Max category page response time (3s)
const SEARCH_DURATION_THRESHOLD = 2500;      // Max search response time (2.5s)
const CART_DURATION_THRESHOLD = 2000;        // Max cart page response time (2s)

// User behavior simulation
const MIN_THINK_TIME = 1;                    // Minimum think time between actions (seconds)
const MAX_THINK_TIME = 4;                    // Maximum think time between actions (seconds)
const BROWSE_JOURNEY_PERCENTAGE = 0.7;       // Percentage of users doing browse journey (70%)
const SEARCH_JOURNEY_PERCENTAGE = 0.2;      // Percentage of users doing search journey (20%)
const CART_JOURNEY_PERCENTAGE = 0.1;        // Percentage of users doing cart journey (10%)

// HTTP headers
const USER_AGENT = 'k6-load-test/1.0 (https://k6.io)';

// =============================================================================

// Custom trends to measure performance of specific pages
const productPageTrend = new Trend('product_page_duration', true);
const categoryPageTrend = new Trend('category_page_duration', true);
const homepageTrend = new Trend('homepage_duration', true);
const searchTrend = new Trend('search_duration', true);
const cartTrend = new Trend('cart_duration', true);

export const options = {
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
  },
  ext: {
    loadimpact: {
      projectID: 3694943,
      name: `Magento 2 Load Test - ${VIRTUAL_USERS} VUs`
    }
  }
};

// The setup function runs once before the test starts.
// It creates realistic URLs based on common Magento patterns.
export function setup() {
  console.log('Running setup... Creating test URLs based on Magento patterns.');
  const params = { headers: { 'User-Agent': USER_AGENT } };
  const res = http.get(BASE_URL, params);

  check(res, { 'Homepage loaded successfully': (r) => r.status === 200 });

  // Create realistic URLs based on common Magento patterns
  const productUrls = [
    `${BASE_URL}/simple-product.html`,
    `${BASE_URL}/configurable-product.html`,
    `${BASE_URL}/virtual-product.html`,
    `${BASE_URL}/downloadable-product.html`,
    `${BASE_URL}/bundle-product.html`,
    `${BASE_URL}/grouped-product.html`,
    `${BASE_URL}/sample-product-1.html`,
    `${BASE_URL}/sample-product-2.html`,
    `${BASE_URL}/sample-product-3.html`,
    `${BASE_URL}/sample-product-4.html`,
    `${BASE_URL}/sample-product-5.html`,
    `${BASE_URL}/sample-product-6.html`,
    `${BASE_URL}/sample-product-7.html`,
    `${BASE_URL}/sample-product-8.html`,
    `${BASE_URL}/sample-product-9.html`,
    `${BASE_URL}/sample-product-10.html`
  ];

  const categoryUrls = [
    `${BASE_URL}/women.html`,
    `${BASE_URL}/men.html`,
    `${BASE_URL}/gear.html`,
    `${BASE_URL}/training.html`,
    `${BASE_URL}/electronics.html`,
    `${BASE_URL}/bags.html`,
    `${BASE_URL}/watches.html`,
    `${BASE_URL}/fitness-equipment.html`,
    `${BASE_URL}/books.html`,
    `${BASE_URL}/video.html`,
    `${BASE_URL}/category.html`,
    `${BASE_URL}/tops-women.html`,
    `${BASE_URL}/bottoms-women.html`,
    `${BASE_URL}/tees-men.html`,
    `${BASE_URL}/pants-men.html`,
    `${BASE_URL}/shorts-men.html`
  ];

  console.log(`Setup complete. Created ${productUrls.length} product URLs and ${categoryUrls.length} category URLs.`);
  return { products: productUrls, categories: categoryUrls };
}

// The default function is the main loop for each virtual user.
export default function (data) {
  const params = {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
    },
  };

  // Randomly choose a user journey based on configurable percentages
  const userJourney = Math.random();
  
  if (userJourney < BROWSE_JOURNEY_PERCENTAGE) {
    // Browse journey: Homepage -> Category -> Product
    group('Browse Journey', function () {
      // Visit homepage
      group('Visit Homepage', function () {
        const res = http.get(BASE_URL, params);
        check(res, { 'Homepage status is 200': (r) => r.status === 200 });
        homepageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time

      // Visit category page
      group('Visit Category Page (catalog/category/view)', function () {
        const categoryUrl = data.categories[Math.floor(Math.random() * data.categories.length)];
        const res = http.get(categoryUrl, params);
        check(res, { 'Category page status is 200': (r) => r.status === 200 });
        categoryPageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time

      // Visit product page
      group('Visit Product Page (catalog/product/view)', function () {
        const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
        const res = http.get(productUrl, params);
        check(res, { 'Product page status is 200': (r) => r.status === 200 });
        productPageTrend.add(res.timings.duration);
      });
    });
  } else if (userJourney < BROWSE_JOURNEY_PERCENTAGE + SEARCH_JOURNEY_PERCENTAGE) {
    // Search journey: Homepage -> Search
    group('Search Journey', function () {
      // Visit homepage
      group('Visit Homepage', function () {
        const res = http.get(BASE_URL, params);
        check(res, { 'Homepage status is 200': (r) => r.status === 200 });
        homepageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time

      // Perform search
      group('Perform Search', function () {
        const searchTerms = ['shirt', 'pants', 'shoes', 'bag', 'watch', 'dress'];
        const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        const searchUrl = `${BASE_URL}/catalogsearch/result/?q=${searchTerm}`;
        const res = http.get(searchUrl, params);
        check(res, { 'Search page status is 200': (r) => r.status === 200 });
        searchTrend.add(res.timings.duration);
      });
    });
  } else {
    // Cart journey: Homepage -> Product -> Cart
    group('Cart Journey', function () {
      // Visit homepage
      group('Visit Homepage', function () {
        const res = http.get(BASE_URL, params);
        check(res, { 'Homepage status is 200': (r) => r.status === 200 });
        homepageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time

      // Visit product page
      group('Visit Product Page (catalog/product/view)', function () {
        const productUrl = data.products[Math.floor(Math.random() * data.products.length)];
        const res = http.get(productUrl, params);
        check(res, { 'Product page status is 200': (r) => r.status === 200 });
        productPageTrend.add(res.timings.duration);
      });

      sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time

      // Visit cart page
      group('Visit Cart Page', function () {
        const cartUrl = `${BASE_URL}/checkout/cart/`;
        const res = http.get(cartUrl, params);
        check(res, { 'Cart page status is 200': (r) => r.status === 200 });
        cartTrend.add(res.timings.duration);
      });
    });
  }

  sleep(Math.random() * (MAX_THINK_TIME - MIN_THINK_TIME) + MIN_THINK_TIME); // Configurable think time
}