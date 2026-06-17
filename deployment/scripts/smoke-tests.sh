#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"

if [ -z "$BASE_URL" ]; then
  echo "Usage: $0 <base-url>"
  exit 2
fi

BASE_URL="${BASE_URL%/}"
OUTPUT_DIR="smoke-test-results"
mkdir -p "$OUTPUT_DIR"

summary_file="$OUTPUT_DIR/summary.md"
{
  echo "# Smoke Test Results"
  echo
  echo "- Base URL: $BASE_URL"
  echo "- Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$summary_file"

check_status() {
  local label="$1"
  local path="$2"
  local allowed="$3"
  local url="$BASE_URL$path"
  local status

  status="$(curl -sS -o "$OUTPUT_DIR/${label}.body" -w "%{http_code}" "$url" || echo "000")"
  echo "- $label: HTTP $status ($path)" >> "$summary_file"

  case ",$allowed," in
    *,"$status",*) return 0 ;;
    *)
      echo "::error::$label failed at $url with HTTP $status; expected one of: $allowed"
      return 1
      ;;
  esac
}

check_status "health" "/api/health" "200,401"
check_status "products" "/api/products?page=1&page_size=1" "200,401"

echo "- Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$summary_file"
cat "$summary_file"
