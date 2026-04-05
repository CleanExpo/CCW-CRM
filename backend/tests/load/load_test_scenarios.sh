#!/bin/bash
#
# CCW-Online ERP Load Testing Scenarios
#
# This script runs various load test scenarios to verify system performance
# under different load conditions.
#
# Prerequisites:
#   1. Install Locust: pip install locust
#   2. Ensure backend is running: http://localhost:8000
#   3. Ensure database has been seeded with test data
#
# Usage:
#   ./load_test_scenarios.sh [scenario_name]
#
# Available scenarios:
#   - smoke: Quick smoke test (10 users, 1 min)
#   - normal: Normal load (100 users, 5 min)
#   - high: High load (1,000 users, 10 min)
#   - stress: Stress test (10,000 users, 10 min)
#   - multi-tenant: Multi-tenant isolation test (1,000 users across 100 tenants)
#   - sustained: Sustained load test (500 users, 30 min)
#   - all: Run all scenarios sequentially

set -e

# Configuration
HOST="${LOAD_TEST_HOST:-http://localhost:8000}"
RESULTS_DIR="./load_test_results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create results directory
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}CCW-Online ERP Load Testing${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Host: $HOST"
echo "Results: $RESULTS_DIR"
echo ""

# Function to run a load test scenario
run_scenario() {
    local name=$1
    local users=$2
    local spawn_rate=$3
    local run_time=$4
    local user_class=${5:-NormalUser}
    local tags=${6:-}

    echo -e "${YELLOW}Running scenario: $name${NC}"
    echo "  Users: $users"
    echo "  Spawn Rate: $spawn_rate/sec"
    echo "  Duration: $run_time"
    echo "  User Class: $user_class"
    if [ -n "$tags" ]; then
        echo "  Tags: $tags"
    fi
    echo ""

    local output_file="$RESULTS_DIR/${name}_${TIMESTAMP}"

    local cmd="locust -f locustfile.py --host=$HOST --users=$users --spawn-rate=$spawn_rate --run-time=$run_time --headless --user-classes=$user_class --html=${output_file}.html --csv=${output_file}"

    if [ -n "$tags" ]; then
        cmd="$cmd --tags=$tags"
    fi

    echo "Command: $cmd"
    echo ""

    if eval "$cmd"; then
        echo -e "${GREEN}✅ Scenario '$name' completed successfully${NC}"
        echo "Results: ${output_file}.html"
        echo ""
    else
        echo -e "${RED}❌ Scenario '$name' failed${NC}"
        return 1
    fi
}

# Smoke Test: Quick validation (10 users, 1 minute)
smoke_test() {
    echo -e "${GREEN}=== SMOKE TEST ===${NC}"
    echo "Quick validation of endpoints with minimal load"
    echo ""
    run_scenario "smoke" 10 2 1m "NormalUser"
}

# Normal Load: Typical production load (100 users, 5 minutes)
normal_load() {
    echo -e "${GREEN}=== NORMAL LOAD TEST ===${NC}"
    echo "Simulating typical production load"
    echo ""
    run_scenario "normal_load" 100 10 5m "NormalUser"
}

# High Load: Peak traffic (1,000 users, 10 minutes)
high_load() {
    echo -e "${GREEN}=== HIGH LOAD TEST ===${NC}"
    echo "Simulating peak traffic conditions"
    echo ""
    run_scenario "high_load" 1000 50 10m "NormalUser"
}

# Stress Test: Maximum capacity (10,000 users, 10 minutes)
stress_test() {
    echo -e "${GREEN}=== STRESS TEST ===${NC}"
    echo "Testing system limits with 10,000 concurrent users"
    echo "Target: 95%+ success rate, p95 <500ms"
    echo ""
    run_scenario "stress_test" 10000 100 10m "NormalUser"
}

# Multi-Tenant Test: Verify tenant isolation under load
multi_tenant_test() {
    echo -e "${GREEN}=== MULTI-TENANT ISOLATION TEST ===${NC}"
    echo "Verifying tenant data isolation with 1,000 users across multiple organizations"
    echo ""
    run_scenario "multi_tenant" 1000 50 10m "MultiTenantUser" "multi-tenant"
}

# Sustained Load: Long-duration test (500 users, 30 minutes)
sustained_load() {
    echo -e "${GREEN}=== SUSTAINED LOAD TEST ===${NC}"
    echo "Testing system stability over 30 minutes"
    echo ""
    run_scenario "sustained_load" 500 25 30m "NormalUser"
}

# Read-Heavy Workload: Mostly reads (500 users, 10 minutes)
read_heavy_test() {
    echo -e "${GREEN}=== READ-HEAVY WORKLOAD TEST ===${NC}"
    echo "Simulating read-heavy traffic (browsing, searching)"
    echo ""
    run_scenario "read_heavy" 500 25 10m "ReadHeavyUser"
}

# Write-Heavy Workload: Mostly writes (200 users, 10 minutes)
write_heavy_test() {
    echo -e "${GREEN}=== WRITE-HEAVY WORKLOAD TEST ===${NC}"
    echo "Simulating write-heavy traffic (creating orders, quotes)"
    echo ""
    run_scenario "write_heavy" 200 10 10m "WriteHeavyUser"
}

# Parse command line arguments
SCENARIO=${1:-normal}

case $SCENARIO in
    smoke)
        smoke_test
        ;;
    normal)
        normal_load
        ;;
    high)
        high_load
        ;;
    stress)
        stress_test
        ;;
    multi-tenant)
        multi_tenant_test
        ;;
    sustained)
        sustained_load
        ;;
    read-heavy)
        read_heavy_test
        ;;
    write-heavy)
        write_heavy_test
        ;;
    all)
        echo -e "${YELLOW}Running ALL load test scenarios${NC}"
        echo ""
        smoke_test
        normal_load
        read_heavy_test
        write_heavy_test
        high_load
        multi_tenant_test
        stress_test
        # Don't run sustained by default (too long)
        echo ""
        echo -e "${GREEN}All scenarios completed!${NC}"
        echo "Note: Sustained load test (30 min) was skipped. Run manually if needed."
        ;;
    *)
        echo -e "${RED}Unknown scenario: $SCENARIO${NC}"
        echo ""
        echo "Available scenarios:"
        echo "  - smoke: Quick smoke test (10 users, 1 min)"
        echo "  - normal: Normal load (100 users, 5 min)"
        echo "  - high: High load (1,000 users, 10 min)"
        echo "  - stress: Stress test (10,000 users, 10 min)"
        echo "  - multi-tenant: Multi-tenant isolation (1,000 users)"
        echo "  - sustained: Sustained load (500 users, 30 min)"
        echo "  - read-heavy: Read-heavy workload (500 users)"
        echo "  - write-heavy: Write-heavy workload (200 users)"
        echo "  - all: Run all scenarios (except sustained)"
        echo ""
        echo "Usage: $0 [scenario]"
        exit 1
        ;;
esac

# Summary
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Load Testing Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
echo "Review HTML reports:"
echo "  ls -lh $RESULTS_DIR/*.html"
echo ""
echo "Performance targets:"
echo "  ✅ p95 response time: <500ms"
echo "  ✅ Success rate: >95%"
echo "  ✅ Error rate: <5%"
echo ""
