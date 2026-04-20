#!/bin/bash
#
# Integration Test Runner for CCW-Online ERP
#
# This script runs integration tests with various configurations.
#
# Usage:
#   ./run_integration_tests.sh [options]
#
# Options:
#   --fast          Use SQLite in-memory (fastest)
#   --postgres      Use PostgreSQL (most realistic)
#   --coverage      Generate coverage report
#   --verbose       Verbose output
#   --module MODULE Run specific test module
#   --class CLASS   Run specific test class
#   --help          Show this help message

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default configuration
USE_POSTGRES=false
COVERAGE=false
VERBOSE=""
TEST_MODULE=""
TEST_CLASS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --fast)
            USE_POSTGRES=false
            shift
            ;;
        --postgres)
            USE_POSTGRES=true
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --verbose)
            VERBOSE="-vv"
            shift
            ;;
        --module)
            TEST_MODULE="$2"
            shift 2
            ;;
        --class)
            TEST_CLASS="$2"
            shift 2
            ;;
        --help)
            echo "Integration Test Runner"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --fast          Use SQLite in-memory (fastest)"
            echo "  --postgres      Use PostgreSQL (most realistic)"
            echo "  --coverage      Generate coverage report"
            echo "  --verbose       Verbose output"
            echo "  --module MODULE Run specific test module (e.g., test_api_endpoints)"
            echo "  --class CLASS   Run specific test class (e.g., TestProductEndpoints)"
            echo "  --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --fast                                 # Quick test with SQLite"
            echo "  $0 --postgres --coverage                  # Full test with coverage"
            echo "  $0 --module test_api_endpoints --verbose  # Test specific module"
            echo "  $0 --class TestProductEndpoints           # Test specific class"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}CCW-Online ERP Integration Tests${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configure database
if [ "$USE_POSTGRES" = true ]; then
    echo -e "${YELLOW}Using PostgreSQL database${NC}"
    export USE_IN_MEMORY_DB=false
    # Local test database. Override TEST_DATABASE_URL to target a different local db.
    export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://starter_user:local_dev_password@localhost:5432/starter_db_test}"

    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${RED}Error: PostgreSQL is not running${NC}"
        echo "Start PostgreSQL or use --fast option for SQLite"
        exit 1
    fi

    # Check if test database exists, create if not
    if ! psql -U starter_user -h localhost -lqt | cut -d \| -f 1 | grep -qw starter_db_test; then
        echo "Creating test database..."
        createdb -U starter_user -h localhost starter_db_test || true
    fi
else
    echo -e "${YELLOW}Using SQLite in-memory database${NC}"
    export USE_IN_MEMORY_DB=true
fi

# Build test command
TEST_CMD="pytest tests/integration/"

if [ -n "$TEST_MODULE" ]; then
    TEST_CMD="pytest tests/integration/${TEST_MODULE}.py"
fi

if [ -n "$TEST_CLASS" ]; then
    if [ -n "$TEST_MODULE" ]; then
        TEST_CMD="pytest tests/integration/${TEST_MODULE}.py::${TEST_CLASS}"
    else
        echo -e "${RED}Error: --class requires --module${NC}"
        exit 1
    fi
fi

# Add verbosity
if [ -n "$VERBOSE" ]; then
    TEST_CMD="$TEST_CMD $VERBOSE"
else
    TEST_CMD="$TEST_CMD -v"
fi

# Add coverage
if [ "$COVERAGE" = true ]; then
    echo -e "${YELLOW}Generating coverage report${NC}"
    TEST_CMD="$TEST_CMD --cov=src --cov-report=html --cov-report=term"
fi

echo ""
echo -e "${YELLOW}Running command:${NC} $TEST_CMD"
echo ""

# Run tests
cd "$(dirname "$0")/.."  # Go to apps/backend directory

if eval "$TEST_CMD"; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo -e "${GREEN}========================================${NC}"

    if [ "$COVERAGE" = true ]; then
        echo ""
        echo -e "${GREEN}Coverage report generated:${NC}"
        echo "  HTML: file://$(pwd)/htmlcov/index.html"
        echo ""
        echo "Open in browser:"
        echo "  open htmlcov/index.html  # macOS"
        echo "  xdg-open htmlcov/index.html  # Linux"
        echo "  start htmlcov/index.html  # Windows"
    fi
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}❌ Tests failed${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
