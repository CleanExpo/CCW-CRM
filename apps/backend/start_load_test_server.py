#!/usr/bin/env python
"""Start uvicorn server with SKIP_AUTH_ENFORCEMENT enabled for load testing."""

import os

import uvicorn

# Enable auth skip for load testing
os.environ["SKIP_AUTH_ENFORCEMENT"] = "true"

if __name__ == "__main__":
    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
