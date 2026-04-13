#!/usr/bin/env python
"""Check what configuration the running backend actually uses."""
import json

import httpx

# Check config endpoint
try:
    r = httpx.get('http://localhost:8000/api/config/settings', timeout=10)
    print("Config endpoint status:", r.status_code)
    if r.status_code == 200:
        print(json.dumps(r.json(), indent=2))
except Exception as e:
    print(f"Config endpoint failed: {e}")

# Check if there's a debug endpoint
try:
    r = httpx.get('http://localhost:8000/api/config/frontend-config', timeout=10)
    print("\nFrontend config status:", r.status_code)
    if r.status_code == 200:
        print(json.dumps(r.json(), indent=2))
except Exception as e:
    print(f"Frontend config failed: {e}")
