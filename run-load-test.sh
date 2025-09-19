#!/bin/bash

# Magento Load Test Script
# This script automatically installs k6 (if needed) and runs a comprehensive load test
# Supports macOS and Linux platforms

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unsupported"
    fi
}

# Function to install k6 on macOS
install_k6_macos() {
    print_status "Installing k6 on macOS..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        print_error "Homebrew is not installed. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    print_status "Installing k6 via Homebrew..."
    brew install k6
    
    if command -v k6 &> /dev/null; then
        print_success "k6 installed successfully!"
    else
        print_error "Failed to install k6"
        exit 1
    fi
}

# Function to install k6 on Linux
install_k6_linux() {
    print_status "Installing k6 on Linux..."
    
    # Detect Linux distribution
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        print_status "Detected Debian/Ubuntu, installing k6..."
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        print_status "Detected CentOS/RHEL, installing k6..."
        sudo yum install https://github.com/grafana/k6/releases/download/v0.47.0/k6-0.47.0-1.x86_64.rpm
    elif command -v dnf &> /dev/null; then
        # Fedora
        print_status "Detected Fedora, installing k6..."
        sudo dnf install https://github.com/grafana/k6/releases/download/v0.47.0/k6-0.47.0-1.x86_64.rpm
    else
        print_error "Unsupported Linux distribution. Please install k6 manually:"
        echo "   Visit: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    if command -v k6 &> /dev/null; then
        print_success "k6 installed successfully!"
    else
        print_error "Failed to install k6"
        exit 1
    fi
}

# Function to install k6
install_k6() {
    local os=$(detect_os)
    
    case $os in
        "macos")
            install_k6_macos
            ;;
        "linux")
            install_k6_linux
            ;;
        *)
            print_error "Unsupported operating system: $OSTYPE"
            echo "Please install k6 manually: https://k6.io/docs/getting-started/installation/"
            exit 1
            ;;
    esac
}

# Function to show usage
show_usage() {
    echo -e "${BLUE}"
    echo "🚀 Magento Load Test Runner"
    echo "=========================="
    echo -e "${NC}"
    echo ""
    echo "Usage: $0 [virtual-users] [duration-seconds] <magento-website-url>"
    echo "   OR: $0 <magento-website-url>"
    echo ""
    echo "Parameters:"
    echo "  virtual-users     Number of concurrent users (optional, default: 500)"
    echo "  duration-seconds  Test duration in seconds (optional, default: 300)"
    echo "  magento-website-url  Target Magento website URL (required)"
    echo ""
    echo "Examples:"
    echo "  $0 https://your-magento-site.com                    # Default: 500 users, 300s"
    echo "  $0 50 60 https://your-magento-site.com             # Custom: 50 users, 60s"
    echo "  $0 100 180 https://staging.your-site.com           # Custom: 100 users, 180s"
    echo "  $0 10 30 https://4kxkvuyyo22dm.dummycachetest.com  # Light: 10 users, 30s"
    echo ""
    echo "Common scenarios:"
    echo "  Light load:    $0 10 30 <url>     # 10 users, 30 seconds"
    echo "  Medium load:   $0 50 120 <url>    # 50 users, 2 minutes"
    echo "  Heavy load:    $0 200 300 <url>   # 200 users, 5 minutes"
    echo "  Stress test:   $0 500 600 <url>   # 500 users, 10 minutes"
    echo ""
    echo "The script will:"
    echo "  • Automatically install k6 if needed"
    echo "  • Create temporary config with your parameters"
    echo "  • Run a comprehensive load test"
    echo ""
}

# Function to validate URL
validate_url() {
    local url=$1
    if [[ ! $url =~ ^https?:// ]]; then
        print_error "Invalid URL format. Please include http:// or https://"
        echo "Example: https://your-magento-site.com"
        return 1
    fi
    return 0
}

# Function to parse arguments and determine parameters
parse_arguments() {
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    # Parse arguments based on number provided
    if [ $# -eq 1 ]; then
        # Format: ./script.sh <url>
        VIRTUAL_USERS=500
        DURATION_SECONDS=300
        MAGENTO_URL=$1
    elif [ $# -eq 3 ]; then
        # Format: ./script.sh <users> <duration> <url>
        VIRTUAL_USERS=$1
        DURATION_SECONDS=$2
        MAGENTO_URL=$3
        
        # Validate numeric parameters
        if ! [[ "$VIRTUAL_USERS" =~ ^[0-9]+$ ]] || [ "$VIRTUAL_USERS" -lt 1 ] || [ "$VIRTUAL_USERS" -gt 10000 ]; then
            print_error "Invalid virtual users: $VIRTUAL_USERS"
            echo "Must be a number between 1 and 10000"
            exit 1
        fi
        
        if ! [[ "$DURATION_SECONDS" =~ ^[0-9]+$ ]] || [ "$DURATION_SECONDS" -lt 1 ] || [ "$DURATION_SECONDS" -gt 7200 ]; then
            print_error "Invalid duration: $DURATION_SECONDS"
            echo "Must be a number between 1 and 7200 seconds (2 hours)"
            exit 1
        fi
    else
        print_error "Invalid number of arguments"
        show_usage
        exit 1
    fi
    
    # Validate URL format
    if ! validate_url "$MAGENTO_URL"; then
        exit 1
    fi
    
    # Calculate durations for k6 stages
    RAMP_UP_DURATION=$((DURATION_SECONDS / 10))  # 10% for ramp up
    SUSTAINED_DURATION=$((DURATION_SECONDS * 8 / 10))  # 80% sustained
    RAMP_DOWN_DURATION=$((DURATION_SECONDS / 10))  # 10% for ramp down
    
    # Ensure minimum durations
    if [ $RAMP_UP_DURATION -lt 5 ]; then RAMP_UP_DURATION=5; fi
    if [ $RAMP_DOWN_DURATION -lt 5 ]; then RAMP_DOWN_DURATION=5; fi
    if [ $SUSTAINED_DURATION -lt 10 ]; then SUSTAINED_DURATION=10; fi
}

# Function to create temporary config with custom parameters
create_temp_config() {
    local TEMP_CONFIG=$(mktemp)
    
    cat > "$TEMP_CONFIG" << EOF
# Temporary configuration generated by run-load-test.sh
loadTest:
  virtualUsers: $VIRTUAL_USERS
  rampUpDuration: "${RAMP_UP_DURATION}s"
  sustainedDuration: "${SUSTAINED_DURATION}s"
  rampDownDuration: "${RAMP_DOWN_DURATION}s"

# Load other settings from default config if it exists
performance:
  httpTimeout: "60s"
  httpErrorThreshold: 0.25
  httpDurationThreshold: 60000
  homepageDurationThreshold: 45000
  productDurationThreshold: 50000
  categoryDurationThreshold: 50000
  searchDurationThreshold: 45000
  cartDurationThreshold: 45000

userBehavior:
  minThinkTime: 1
  maxThinkTime: 4
  browseJourneyPercentage: 0.4
  searchJourneyPercentage: 0.2
  cartJourneyPercentage: 0.1
  windowShoppingPercentage: 0.05
  quickBuyerPercentage: 0.05
  comprehensiveShoppingPercentage: 0.2

ecommerceFlow:
  maxCategoriesPerSession: 3
  maxProductsPerCategory: 4
  maxProductsInCart: 5
  checkoutCompletionRate: 0.8
  categoryReturnRate: 0.6
  productComparisonRate: 0.4
  addToCartMinQty: 1
  addToCartMaxQty: 3

browsingPatterns:
  maxBrowsingActions: 12
  minBrowsingActions: 5
  relatedProductFollowRate: 0.6
  paginationFollowRate: 0.4
  breadcrumbFollowRate: 0.3
  interestMatchFollowRate: 0.8
  randomExplorationRate: 0.5
  distractionRate: 0.15
  comparisonShoppingRate: 0.4
  impulseBuyingRate: 0.25

api:
  enableApiLoad: false
  enableGraphqlLoad: false
  enableRestLoad: false
  apiTrafficPercentage: 0.0

cache:
  cacheBypassPercentage: 0.3
  enableCacheBypass: true

urlDiscovery:
  enableUrlDiscovery: false
  enableFallbackUrls: true
  enableDeepCrawling: false
  maxCrawlDepth: 1
  validateUrlsBeforeUse: false
  maxProducts: 500
  maxCategories: 50
  maxSearchTerms: 20

realUrls:
  fallbackCategorySlugs:
    - "category-4"
    - "category-5"
    - "category-4/category-4-1"
    - "category-4/category-4-2" 
    - "category-4/category-4-3"
    - "category-5/category-5-1"
    - "category-5/category-5-2"
    - "gear"
    - "gear/bags"
    - "gear/fitness-equipment"
    - "gear/watches"
    - "training"
    - "training/training-video"
    - "collections/yoga-new"
  realProductUrls:
    - "radiant-tee.html"
    - "breathe-easy-tank.html"
    - "argus-all-weather-tank.html"
    - "hero-hoodie.html"
    - "fusion-backpack.html"
    - "push-it-messenger-bag.html"
    - "sprite-yoga-companion-kit.html"
    - "affirm-water-bottle.html"
    - "quest-lumaflex-tone-band.html"
    - "fitbit-charge-3.html"
  fallbackSearchTerms:
    - "shirt"
    - "pants"
    - "shoes"
    - "bag"
    - "watch"
    - "dress"
    - "jacket"
    - "hat"
    - "belt"
    - "socks"

paths:
  cartPagePath: "/checkout/cart/"
  checkoutPagePath: "/checkout/onepage/"
  addToCartPath: "/checkout/cart/add/"
  searchResultPathTemplate: "/catalogsearch/result/?q={q}"
  graphqlPath: "/graphql"
EOF
    
    echo "$TEMP_CONFIG"
}

# Main script
main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    echo -e "${BLUE}"
    echo "🚀 Magento Load Test Runner"
    echo "=========================="
    echo -e "${NC}"
    
    print_status "Website: $MAGENTO_URL"
    print_status "Virtual Users: $VIRTUAL_USERS concurrent users"
    print_status "Duration: ${DURATION_SECONDS}s total (${RAMP_UP_DURATION}s ramp-up, ${SUSTAINED_DURATION}s sustained, ${RAMP_DOWN_DURATION}s ramp-down)"
    print_status "Cache Bypass: 30% of requests (for New Relic visibility)"
    echo ""
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        print_warning "k6 is not installed"
        
        # Ask user if they want to install k6
        read -p "Would you like to install k6 automatically? (y/n): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_k6
        else
            print_error "k6 is required to run the load test"
            echo "Please install k6 manually: https://k6.io/docs/getting-started/installation/"
            exit 1
        fi
    else
        print_success "k6 is already installed"
    fi
    
    # Check if the load test script exists
    if [ ! -f "k6-magento-load-test.js" ]; then
        print_error "Load test script 'k6-magento-load-test.js' not found"
        echo "Please ensure you're running this script from the correct directory"
        exit 1
    fi
    
    # Create temporary config with custom parameters
    print_status "Creating temporary configuration..."
    local TEMP_CONFIG_FILE=$(create_temp_config)
    
    # Backup existing config if present
    local BACKUP_CONFIG=""
    if [ -f "load-test-config.yaml" ]; then
        BACKUP_CONFIG=$(mktemp)
        cp load-test-config.yaml "$BACKUP_CONFIG"
        print_status "Backed up existing load-test-config.yaml"
    fi
    
    # Use temporary config
    cp "$TEMP_CONFIG_FILE" load-test-config.yaml
    
    print_success "Starting load test..."
    echo ""
    
    # Run the load test with environment variable
    MAGENTO_URL="$MAGENTO_URL" k6 run k6-magento-load-test.js
    
    # Restore original config if it existed
    if [ -n "$BACKUP_CONFIG" ]; then
        cp "$BACKUP_CONFIG" load-test-config.yaml
        rm -f "$BACKUP_CONFIG"
        print_status "Restored original load-test-config.yaml"
    else
        rm -f load-test-config.yaml
        print_status "Removed temporary configuration"
    fi
    
    # Clean up temporary files
    rm -f "$TEMP_CONFIG_FILE"
    
    echo ""
    print_success "Load test completed!"
    echo ""
    print_status "Check the results above for:"
    echo "  • Performance metrics (response times, error rates)"
    echo "  • Threshold violations (if any)"
    echo "  • New Relic visibility (30% cache bypass)"
    echo ""
    print_status "For detailed analysis, check your New Relic dashboard"
}

# Run main function
main "$@"
