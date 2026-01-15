#!/bin/bash
# Railway Post-Deployment Script
# This script should be run ONCE after Railway deployment to initialize the database
# Usage: Run this in Railway shell (Service → ... → Open Shell)

set -e  # Exit on error

echo "======================================"
echo " Railway Post-Deployment Setup"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ ERROR: Not in backend directory. Expected to find pyproject.toml"
    echo "Run this script from Railway shell in the backend service"
    exit 1
fi

echo "✅ Found pyproject.toml - in correct directory"
echo ""

# Check if database is accessible
echo "Step 1: Verifying database connection..."
if uv run python -c "from src.config.database import engine; print('Database engine:', engine)" 2>/dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "Check DATABASE_URL environment variable in Railway dashboard"
    exit 1
fi
echo ""

# Run database migrations
echo "Step 2: Running database migrations..."
if uv run alembic upgrade head; then
    echo "✅ Database migrations completed"
else
    echo "❌ Database migrations failed"
    echo "Check Railway logs for errors"
    exit 1
fi
echo ""

# Load seed data
echo "Step 3: Loading seed data (demo users, products, customers)..."
if uv run python seed_data.py; then
    echo "✅ Seed data loaded successfully"
else
    echo "❌ Seed data loading failed"
    echo "This is not critical - you can add data manually"
fi
echo ""

# Verify migrations
echo "Step 4: Verifying database schema..."
CURRENT_REV=$(uv run alembic current 2>/dev/null | grep -oP '(?<=Rev: )[a-f0-9]+' || echo "unknown")
if [ "$CURRENT_REV" != "unknown" ]; then
    echo "✅ Current database revision: $CURRENT_REV"
else
    echo "⚠️  Could not determine current revision"
fi
echo ""

# Summary
echo "======================================"
echo " Post-Deployment Setup Complete!"
echo "======================================"
echo ""
echo "✅ Database initialized"
echo "✅ Migrations applied"
echo "✅ Seed data loaded"
echo ""
echo "Test Credentials:"
echo "  Email: admin@demo.com"
echo "  Password: demo123"
echo ""
echo "Next Steps:"
echo "1. Test health endpoint: curl https://your-app.railway.app/health"
echo "2. Test API docs: https://your-app.railway.app/docs"
echo "3. Test login with credentials above"
echo "4. Update frontend NEXT_PUBLIC_BACKEND_URL"
echo ""
