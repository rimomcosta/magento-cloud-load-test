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
    echo "Usage: $0 <magento-website-url>"
    echo ""
    echo "Examples:"
    echo "  $0 https://your-magento-site.com"
    echo "  $0 https://staging.your-site.com"
    echo "  $0 https://4kxkvuyyo22dm.dummycachetest.com"
    echo ""
    echo "The script will:"
    echo "  • Automatically install k6 if needed"
    echo "  • Update the load test script with your website URL"
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

# Main script
main() {
    # Check if URL argument is provided
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    local MAGENTO_URL=$1
    
    # Validate URL format
    if ! validate_url "$MAGENTO_URL"; then
        exit 1
    fi
    
    echo -e "${BLUE}"
    echo "🚀 Magento Load Test Runner"
    echo "=========================="
    echo -e "${NC}"
    
    print_status "Website: $MAGENTO_URL"
    print_status "Test Configuration: 500 VUs, 5-minute sustained load"
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
    
    # Update the BASE_URL in the k6 script
    print_status "Updating load test script with website URL..."
    
    # Create a temporary script with the updated URL
    local TEMP_SCRIPT=$(mktemp)
    
    # Replace the BASE_URL in the script
    sed "s|const BASE_URL = 'https://4kxkvuyyo22dm.dummycachetest.com';|const BASE_URL = '$MAGENTO_URL';|g" k6-magento-load-test.js > "$TEMP_SCRIPT"
    
    if [ $? -eq 0 ]; then
        print_success "Load test script updated with $MAGENTO_URL"
    else
        print_error "Failed to update load test script"
        rm -f "$TEMP_SCRIPT"
        exit 1
    fi
    
    print_success "Starting load test..."
    echo ""
    
    # Run the load test with the temporary script
    k6 run "$TEMP_SCRIPT"
    
    # Clean up temporary file
    rm -f "$TEMP_SCRIPT"
    
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
