#!/bin/bash

# Magento Load Test Script
# This script runs a comprehensive load test on your Magento website

echo "🚀 Starting Magento Load Test..."
echo "Website: https://4kxkvuyyo22dm.dummycachetest.com"
echo "Test Duration: ~3 minutes (30s ramp-up + 2m sustained + 10s ramp-down)"
echo "Virtual Users: 20 concurrent users"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed. Please install k6 first:"
    echo "   macOS: brew install k6"
    echo "   Linux: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

echo "✅ k6 found, starting load test..."
echo ""

# Run the load test
k6 run k6-magento-load-test.js

echo ""
echo "🏁 Load test completed!"
echo "Check the results above for performance metrics and any threshold violations."
