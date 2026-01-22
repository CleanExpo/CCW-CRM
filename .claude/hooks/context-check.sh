#!/bin/bash
TOKENS=${1:-0}
if [ "$TOKENS" -gt 120000 ]; then
  echo "⚠️ Context high: $TOKENS tokens"
  echo "Consider running /context compact"
fi
