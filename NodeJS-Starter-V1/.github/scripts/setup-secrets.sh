#!/bin/bash
#
# GitHub Secrets Setup Script
#
# This script helps you add required secrets to GitHub repository.
# Run this after obtaining tokens from respective services.
#
# Usage:
#   1. Get tokens from services (see .github/SECRETS.md)
#   2. Run: bash .github/scripts/setup-secrets.sh
#   3. Follow the prompts to enter each secret
#

set -e

echo "🔐 GitHub Secrets Setup for NodeJS-Starter-V1"
echo "=============================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo ""
    echo "Install with:"
    echo "  - macOS:   brew install gh"
    echo "  - Windows: winget install GitHub.cli"
    echo "  - Linux:   See https://github.com/cli/cli#installation"
    echo ""
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not authenticated with GitHub"
    echo ""
    echo "Run: gh auth login"
    echo ""
    exit 1
fi

echo "✅ GitHub CLI is installed and authenticated"
echo ""

# Function to add secret
add_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_optional=$3

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Setting: $secret_name"
    echo "Purpose: $secret_description"

    if [ "$is_optional" = "optional" ]; then
        echo "Status:  OPTIONAL"
        read -p "Do you want to add this secret? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "⏭️  Skipped"
            echo ""
            return
        fi
    else
        echo "Status:  REQUIRED"
    fi

    read -sp "Enter value (input hidden): " secret_value
    echo ""

    if [ -z "$secret_value" ]; then
        echo "⚠️  Empty value - skipping"
        echo ""
        return
    fi

    if gh secret set "$secret_name" -b "$secret_value"; then
        echo "✅ Secret '$secret_name' added successfully"
    else
        echo "❌ Failed to add secret '$secret_name'"
    fi
    echo ""
}

# Required secrets for testing workflows
echo "📋 REQUIRED SECRETS (Priority 1 - Testing)"
echo ""

add_secret "PERCY_TOKEN" \
    "Visual regression testing with Percy.io" \
    "required"

add_secret "PACT_BROKER_BASE_URL" \
    "Pact contract testing broker URL (e.g., https://your-org.pactflow.io)" \
    "required"

add_secret "PACT_BROKER_TOKEN" \
    "Pact broker authentication token" \
    "required"

add_secret "CODECOV_TOKEN" \
    "Code coverage reporting with Codecov" \
    "required"

# Optional secrets for security
echo "📋 OPTIONAL SECRETS (Priority 2 - Security)"
echo ""

add_secret "SNYK_TOKEN" \
    "Vulnerability scanning with Snyk (highly recommended)" \
    "optional"

# Optional secrets for deployment
echo "📋 OPTIONAL SECRETS (Priority 3 - Deployment)"
echo ""

add_secret "DIGITALOCEAN_ACCESS_TOKEN" \
    "Backend deployment to DigitalOcean" \
    "optional"

add_secret "VERCEL_TOKEN" \
    "Frontend deployment to Vercel (if not using GitHub integration)" \
    "optional"

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Secrets setup complete!"
echo ""
echo "📋 To verify secrets were added:"
echo "   gh secret list"
echo ""
echo "🧪 To test workflows:"
echo "   gh workflow run advanced-testing.yml"
echo "   gh workflow run security.yml"
echo ""
echo "📖 For detailed documentation, see:"
echo "   .github/SECRETS.md"
echo ""
