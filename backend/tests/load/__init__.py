"""
Load testing package for CCW-Online ERP.

This package provides comprehensive load testing capabilities using Locust.

Modules:
    locustfile: Main load test scenarios and user classes

Usage:
    # Run load tests
    locust -f locustfile.py --host=http://localhost:8000

    # Or use convenience scripts
    ./load_test_scenarios.sh stress
    .\load_test_scenarios.ps1 -Scenario stress
"""

__version__ = "1.0.0"
__author__ = "CCW ERP Team"
