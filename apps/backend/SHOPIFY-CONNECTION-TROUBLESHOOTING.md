# Shopify Connection Troubleshooting

## Current Status: 401 Authentication Error

**Error Message:**
```
Shopify API error (401): {"errors":"[API] Invalid API key or access token (unrecognized login or wrong password)"}
```

## Configuration Being Used

- **Shop Domain**: ccwonline.myshopify.com
- **API Version**: 2024-01
- **Admin API URL**: https://ccwonline.myshopify.com/admin/api/2024-01
- **Access Token**: shpss_0667bfd74... (truncated)
- **Authentication Method**: X-Shopify-Access-Token header

## Credentials Provided

1. **ID**: `0351bb1e6065cfaee975387e6feaf9a4` (32 char hex - API Key)
2. **Secret**: `shpss_XXXXXXXXXXXXXXXXXXXX` (38 char with shpss_ prefix - Access Token)

## Analysis

The `shpss_` prefix indicates this is a **legacy private app** access token. For private apps, authentication uses only the access token in the `X-Shopify-Access-Token` header, which is what we're doing correctly.

## Possible Causes

1. **Credentials Not Active**
   - The private app may not be installed/activated on the store
   - The access token may have been regenerated or revoked

2. **Incorrect API Access Scopes**
   - The app may not have the required permissions:
     - `read_products`, `write_products`
     - `read_orders`, `write_orders`
     - `read_inventory`, `write_inventory`
     - `read_locations`

3. **Wrong Credentials**
   - The ID and Secret might be swapped
   - The credentials might be for a different app or store

4. **API Version Mismatch**
   - Currently using 2024-01, but app might be configured for different version

## Required Actions

### 1. Verify Private App Configuration

Go to Shopify Admin:
1. Navigate to: **Settings → Apps and sales channels → Develop apps**
2. Find the private app (or create one if it doesn't exist)
3. Verify the **Admin API access token** matches your configured token

### 2. Check API Access Scopes

In the private app configuration, ensure these scopes are enabled:

**Products:**
- ✅ read_products
- ✅ write_products

**Orders:**
- ✅ read_orders
- ✅ write_orders

**Inventory:**
- ✅ read_inventory
- ✅ write_inventory

**Locations:**
- ✅ read_locations

**Customers (optional):**
- ✅ read_customers
- ✅ write_customers

### 3. Verify App Installation

1. Ensure the app status is "Installed"
2. If not installed, click "Install app"
3. After installation, a new access token will be generated - use that new token

### 4. Test with Different API Version

If the above doesn't work, try changing the API version in `.env`:
```env
SHOPIFY_API_VERSION=2025-01  # Try latest version
```

Or:
```env
SHOPIFY_API_VERSION=2023-10  # Try older stable version
```

## Next Steps

1. Please verify the credentials in Shopify Admin
2. Check that the private app is installed and has correct scopes
3. If credentials were regenerated, provide the new access token
4. Confirm the shop domain is exactly: `ccwonline.myshopify.com`

## Alternative Authentication Methods

If private app doesn't work, we can switch to:

### Option A: Custom App (Recommended for Production)
- Create a custom app in Shopify Admin
- Get a `shpat_` or `shpca_` access token
- More granular permission control

### Option B: OAuth Flow
- Implement full OAuth2 flow
- Better for multi-store installations
- Requires web server for callback

## Test Command

Once credentials are verified, run:
```bash
cd apps/backend
python test_shopify_connection.py
```

Expected successful output:
```
[OK] Shop Name: CCW Online
[OK] Found X products
[OK] Found X orders
[OK] Found X location(s)
[SUCCESS] ALL TESTS PASSED
```
