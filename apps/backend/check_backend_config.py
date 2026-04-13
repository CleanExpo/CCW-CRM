#!/usr/bin/env python
"""Check what configuration the backend is actually loading."""

import sys

sys.path.insert(0, 'src')

from config.settings import get_settings

settings = get_settings()

print("=" * 80)
print("BACKEND CONFIGURATION CHECK")
print("=" * 80)

print(f"\nDatabase URL: {settings.database_url}")
print(f"Skip Auth: {settings.skip_auth_enforcement}")
print(f"Debug: {settings.debug}")
print(f"Environment: {settings.environment}")
print(f"Redis Host: {settings.redis_host}")
print(f"Redis Port: {settings.redis_port}")

print("\n" + "=" * 80)
print("EXPECTED vs ACTUAL")
print("=" * 80)

expected_db = "postgresql://ccw_staging:postgres@localhost:5434/ccw_erp_staging"
actual_db = settings.database_url

print(f"\nExpected DB URL: {expected_db}")
print(f"Actual DB URL:   {actual_db}")
print(f"Match: {expected_db == actual_db}")

print("\nExpected Skip Auth: True")
print(f"Actual Skip Auth:   {settings.skip_auth_enforcement}")
print(f"Match: {settings.skip_auth_enforcement == True}")

