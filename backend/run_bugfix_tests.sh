#!/bin/bash
# Bash script to run bug fix tests
# Usage: ./run_bugfix_tests.sh

set -e

echo -e "\033[36mBug Fix Test Runner\033[0m"
echo -e "\033[36m===================\033[0m"
echo ""

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo -e "\033[31mError: Must be run from apps/backend directory\033[0m"
    exit 1
fi

# Install test dependencies if needed
echo -e "\033[33mInstalling test dependencies...\033[0m"
pip install -e ".[dev]" --quiet

if [ $? -ne 0 ]; then
    echo -e "\033[31mFailed to install dependencies\033[0m"
    exit 1
fi

echo -e "\033[32mDependencies installed successfully\n\033[0m"

# Run tests
echo -e "\033[33mRunning bug fix tests...\033[0m"
echo ""

pytest tests/api/test_erp_bugfixes.py -v --tb=short

if [ $? -eq 0 ]; then
    echo -e "\n\033[32m✅ All tests passed!\033[0m"
else
    echo -e "\n\033[31m❌ Some tests failed\033[0m"
    exit 1
fi
