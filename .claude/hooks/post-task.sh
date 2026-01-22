#!/bin/bash
echo "📝 Post-task cleanup..."
# Clean temporary files if .tmp exists
if [ -d ".tmp" ]; then
  rm -rf .tmp/*
  echo "✅ Temp files cleaned"
fi
