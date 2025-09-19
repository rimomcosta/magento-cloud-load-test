# Magento Load Testing Suite

A comprehensive load testing solution for Magento websites using k6, designed to simulate realistic e-commerce user behavior and provide detailed performance insights.

## 🚀 Quick Start

### One-Command Setup & Run

```bash
chmod +x run-load-test.sh
./run-load-test.sh https://your-magento-site.com
```

**Flexible Parameter Support:**
```bash
# Default settings (500 users, 300 seconds)
./run-load-test.sh https://your-magento-site.com

# Custom load (50 users, 60 seconds)
./run-load-test.sh 50 60 https://your-magento-site.com

# Different scenarios
./run-load-test.sh 10 30 https://staging.your-site.com     # Light load
./run-load-test.sh 100 180 https://your-magento-site.com   # Medium load
./run-load-test.sh 500 600 https://your-magento-site.com   # Heavy load
```

The script will:
- ✅ Automatically detect your OS (macOS/Linux)
- ✅ Install k6 if not present (with your permission)
- ✅ Load configuration from `load-test-config.yaml` (if present)
- ✅ Run comprehensive e-commerce user journeys
- ✅ Provide detailed performance metrics

### Configuration System

Create `load-test-config.yaml` to customize any aspect of the load test with explanatory comments:

```yaml
# Load test parameters
loadTest:
  # Number of concurrent virtual users (simulated customers)
  # Light: 10-50, Medium: 100-200, Heavy: 300-500
  virtualUsers: 100
  
  # Time to maintain peak load (main testing period)
  sustainedDuration: "3m"

# User behavior simulation
userBehavior:
  # User journey distribution (must sum to 1.0 or less)
  comprehensiveShoppingPercentage: 0.3  # Multi-category browsers
  browseJourneyPercentage: 0.4          # Traditional shoppers

# E-commerce flow configuration
ecommerceFlow:
  # Maximum categories a user will browse in one session
  maxCategoriesPerSession: 2
  
  # Percentage of users who complete checkout (0.0-1.0)
  checkoutCompletionRate: 0.8

# API traffic control (easily adjustable!)
api:
  enableApiLoad: true
  enableGraphqlLoad: true
  enableRestLoad: true
  apiTrafficPercentage: 0.05    # 5% API traffic (increase to 0.3 for 30%)

# Browsing patterns
browsingPatterns:
  maxBrowsingActions: 12
  relatedProductFollowRate: 0.6   # Users follow related products
  paginationFollowRate: 0.4       # Users browse category pages
  interestMatchFollowRate: 0.8    # Users follow their interests
```

## 📋 Prerequisites

### Automatic Installation (Recommended)
The script handles k6 installation automatically for:
- **macOS**: Via Homebrew
- **Linux**: Debian/Ubuntu, CentOS/RHEL, Fedora

### Manual Installation
If you prefer manual installation:

**macOS:**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Linux (CentOS/RHEL):**
```bash
sudo yum install https://github.com/grafana/k6/releases/download/v0.47.0/k6-0.47.0-1.x86_64.rpm
```

## 🎯 What This Load Test Does

### Realistic E-commerce Simulation
- **Browse & Purchase Journey (60%)**: Homepage → Category → Product → Add to Cart
- **Search & Purchase Journey (25%)**: Homepage → Search → Product → Add to Cart  
- **Cart Abandonment Journey (10%)**: Homepage → Product → Add to Cart → Cart → Checkout Initiation
- **Window Shopping (5%)**: Light browsing without purchases

### Magento-Specific Testing
- **Homepage Performance**: `cms/index/index`
- **Category Pages**: `catalog/category/view` 
- **Product Pages**: `catalog/product/view`
- **Search Functionality**: `catalogsearch/result/index`
- **Cart Operations**: Add to cart, cart page, checkout initiation
- **API Load**: GraphQL and REST API endpoints

### Advanced Features
- **Configurable Product Support**: Handles size/color options automatically
- **Enhanced Session Management**: Cookie tracking and session persistence
- **Mobile User Simulation**: 40% mobile users with different behavior patterns
- **Cart Management**: Add, modify, remove items, apply coupons
- **Customer Account Areas**: Login, registration, account dashboard
- **Wishlist & Comparison**: Product wishlist and comparison functionality
- **Flexible API Control**: Adjust GraphQL/REST traffic from 5% to 50%+
- **Cache Bypass**: 30% of requests bypass cache for New Relic visibility
- **Error Handling**: Graceful handling of timeouts and server errors

## ⚙️ Configuration

All test parameters are configurable at the top of `k6-magento-load-test.js`:

### Load Test Parameters
```javascript
const VIRTUAL_USERS = 500;                     // Concurrent users
const RAMP_UP_DURATION = '60s';               // Ramp-up time
const SUSTAINED_DURATION = '5m';              // Sustained load duration
const RAMP_DOWN_DURATION = '60s';             // Ramp-down time
```

### Performance Thresholds
```javascript
const HTTP_ERROR_THRESHOLD = 0.25;             // Max error rate (25%)
const HTTP_DURATION_THRESHOLD = 60000;         // Max response time (60s)
const HOMEPAGE_DURATION_THRESHOLD = 45000;     // Homepage threshold (45s)
const PRODUCT_DURATION_THRESHOLD = 50000;      // Product page threshold (50s)
const CATEGORY_DURATION_THRESHOLD = 50000;     // Category page threshold (50s)
```

### User Behavior
```javascript
const BROWSE_JOURNEY_PERCENTAGE = 0.6;        // Browse & purchase (60%)
const SEARCH_JOURNEY_PERCENTAGE = 0.25;        // Search & purchase (25%)
const CART_JOURNEY_PERCENTAGE = 0.1;           // Cart abandonment (10%)
const WINDOW_SHOPPING_PERCENTAGE = 0.05;       // Window shopping (5%)
```

### Cache & Monitoring
```javascript
const CACHE_BYPASS_PERCENTAGE = 0.3;           // Cache bypass (30%)
const ENABLE_API_LOAD = true;                  // API testing enabled
const API_TRAFFIC_PERCENTAGE = 0.3;            // API traffic (30%)
```

## 📊 Understanding Results

### Key Metrics
- **HTTP Request Duration**: Response times for all requests
- **HTTP Request Failed**: Error rate percentage
- **Custom Trends**: Specific page performance (homepage, product, category, etc.)
- **Iterations**: Number of complete user journeys
- **Virtual Users**: Concurrent user simulation

### Enhanced User Journeys

**1. Comprehensive Shopping Journey (20%)**
```
Homepage → Category A → Products 1-3 → Category B → Products 4-6 → 
Return to Category A → Compare → Add to Cart → Cart → Checkout
```
- Browse 2-3 categories per session
- View 1-4 products per category  
- Return to previous categories for comparison
- Add multiple products to cart (up to 5 items)
- 70% checkout completion rate

**2. Browse & Purchase Journey (40%)**
```
Homepage → Category → Product → Add to Cart → Cart
```

**3. Search & Purchase Journey (20%)**
```
Homepage → Search → Product → Add to Cart
```

**4. Cart Abandonment Journey (10%)**
```
Homepage → Product → Add to Cart → Cart → Checkout → Abandon
```

**5. Window Shopping Journey (5%)**
```
Homepage → Browse Categories → View Products (no purchase)
```

**6. Quick Buyer Journey (5%)**
```
Homepage → Product → Add to Cart → Cart → Checkout (fast)
```

### Threshold Monitoring
The test monitors these performance criteria:
- ✅ **Pass**: Response times within thresholds
- ❌ **Fail**: Response times exceed thresholds (indicates server stress)

### New Relic Integration
- **30% Cache Bypass**: Ensures backend traffic visibility
- **Real Transaction Names**: `catalog/category/view`, `catalog/product/view`
- **API Monitoring**: GraphQL and REST endpoint performance

### Traffic Distribution Control

**Easily adjust traffic to any Magento area:**

```yaml
# Focus on API testing
api:
  apiTrafficPercentage: 0.3    # 30% API traffic (increased from 5%)

# Focus on catalog browsing  
browsingPatterns:
  relatedProductFollowRate: 0.8   # 80% follow related products
  paginationFollowRate: 0.7       # 70% browse category pages

# Focus on cart and checkout
ecommerceFlow:
  checkoutCompletionRate: 0.9     # 90% complete checkout
  maxProductsInCart: 8            # Larger cart sizes
```

**Common Testing Scenarios:**

```yaml
# API Performance Testing (increase GraphQL/REST)
api:
  apiTrafficPercentage: 0.4    # 40% API traffic (vs default 5%)

# Catalog Performance Testing (focus on browsing)
browsingPatterns:
  maxBrowsingActions: 20       # More page views per session
  relatedProductFollowRate: 0.9   # 90% follow related products
  paginationFollowRate: 0.8       # 80% browse category pages

# Checkout Flow Testing (focus on purchasing)
ecommerceFlow:
  checkoutCompletionRate: 0.95    # 95% complete checkout
  maxProductsInCart: 8            # Larger cart sizes
  
# Mobile-Heavy Testing (focus on mobile users)
browsingPatterns:
  minBrowsingActions: 3           # Shorter mobile sessions
  maxBrowsingActions: 8
```

### Quick Traffic Adjustments

**Want to test specific areas? Just adjust these values:**

- **More GraphQL**: `api.apiTrafficPercentage: 0.3` (30% API traffic)
- **More Categories**: `browsingPatterns.paginationFollowRate: 0.8` (80% category browsing)
- **More Cart Activity**: `ecommerceFlow.checkoutCompletionRate: 0.9` (90% checkout)
- **More Products**: `browsingPatterns.relatedProductFollowRate: 0.9` (90% product following)
- **Shorter Sessions**: `browsingPatterns.maxBrowsingActions: 5` (quick sessions)
- **Longer Sessions**: `browsingPatterns.maxBrowsingActions: 25` (extensive browsing)

## 🔧 Customization

### Changing Target Website
**Method 1: Command Line (Recommended)**
```bash
./run-load-test.sh https://your-magento-site.com
```

**Method 2: Environment Variable**
```bash
MAGENTO_URL=https://your-magento-site.com k6 run k6-magento-load-test.js
```

**Method 3: Manual Edit**
Update the `BASE_URL` in `k6-magento-load-test.js`:
```javascript
const BASE_URL = 'https://your-magento-site.com';
```

**Note**: The MAGENTO_URL environment variable is REQUIRED. The script will fail with a clear error message if no URL is provided.

### Adjusting Load Profile
For different scenarios:

**Light Load (Development):**
```javascript
const VIRTUAL_USERS = 10;
const SUSTAINED_DURATION = '1m';
```

**Medium Load (Staging):**
```javascript
const VIRTUAL_USERS = 50;
const SUSTAINED_DURATION = '3m';
```

**Heavy Load (Production):**
```javascript
const VIRTUAL_USERS = 500;
const SUSTAINED_DURATION = '5m';
```

### URL Discovery
Enable/disable automatic URL discovery:
```javascript
const ENABLE_URL_DISCOVERY = true;             // Auto-discover URLs
const ENABLE_FALLBACK_URLS = true;             // Use fallback URLs
```

## 🚨 Troubleshooting

### Common Issues

**"k6 command not found"**
- Run `./run-load-test.sh` - it will offer to install k6 automatically
- Or install manually using the commands in the Prerequisites section

**"Setup execution timed out"**
- The script is configured with resilient setup that uses fallback URLs
- This prevents hanging when the server is under heavy load

**"Request Failed - timeout"**
- Expected behavior under heavy load
- Indicates server is reaching its limits
- Check performance thresholds in results

**"No catalog/category/view in New Relic"**
- Ensure `CACHE_BYPASS_PERCENTAGE = 0.3` (30%)
- Verify category URLs exist on your site
- Check Fastly VCL configuration

### Performance Issues

**High Error Rates**
- Reduce `VIRTUAL_USERS` for lighter load
- Increase `HTTP_TIMEOUT` for slower responses
- Check server resources and database performance

**Slow Response Times**
- Optimize Magento configuration
- Enable Redis caching
- Review database queries
- Consider CDN optimization

## 📁 File Structure

```
load_test/
├── k6-magento-load-test.js    # Main load test script
├── run-load-test.sh            # Automated setup and execution
└── README.md                   # This documentation
```

## 🎯 Use Cases

### Pre-Launch Testing
- Validate server capacity before going live
- Identify performance bottlenecks
- Test under realistic user loads

### Promotional Day Preparation
- Simulate Black Friday/Cyber Monday traffic
- Test cache performance under load
- Validate New Relic monitoring

### Performance Optimization
- Baseline performance measurement
- A/B testing different configurations
- Continuous performance monitoring

### Capacity Planning
- Determine optimal server resources
- Plan for traffic growth
- Validate scaling strategies

## 📈 Best Practices

### Before Running Load Tests
1. **Backup your site** - Load tests can stress your server
2. **Test on staging first** - Validate configuration before production
3. **Monitor resources** - Watch CPU, memory, and database during tests
4. **Start small** - Begin with light load and increase gradually

### During Load Tests
1. **Monitor New Relic** - Watch real-time performance metrics
2. **Check server logs** - Look for errors or warnings
3. **Watch resource usage** - Ensure server doesn't crash
4. **Document results** - Save metrics for comparison

### After Load Tests
1. **Analyze results** - Review performance metrics and thresholds
2. **Identify bottlenecks** - Look for slow queries or resource limits
3. **Optimize issues** - Address performance problems found
4. **Plan improvements** - Update infrastructure based on findings

## 🤝 Contributing

This load testing suite is designed to be:
- **Configurable**: Easy to modify for different scenarios
- **Robust**: Handles errors gracefully
- **Realistic**: Simulates actual user behavior
- **Comprehensive**: Covers all major Magento functionality

Feel free to customize the configuration parameters for your specific needs.

## 📚 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Magento Performance Best Practices](https://devdocs.magento.com/guides/v2.4/performance-best-practices/)
- [New Relic APM](https://docs.newrelic.com/docs/apm/)
- [Fastly VCL Documentation](https://docs.fastly.com/en/guides/vcl/)

---

**Happy Load Testing!** 🚀

For questions or issues, check the troubleshooting section or review the k6 documentation.
