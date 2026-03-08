# Frontend-Backend Connection Fix Guide

## Current Status ✅

Both services are running and healthy:
- **Backend**: http://localhost:8000 ✅ (responding correctly)
- **Frontend**: http://localhost:3006 ✅ (running)
- **Database**: PostgreSQL on port 5434 ✅ (healthy)

## Issue Diagnosis

The connection between frontend and backend is correctly configured:
- ✅ Backend API responding: `curl http://localhost:8000/health` works
- ✅ Login endpoint working: `curl -X POST http://localhost:8000/api/auth/login` works
- ✅ CORS configured correctly: `["http://localhost:3000","http://localhost:3005","http://localhost:3006"]`
- ✅ Environment variable set: `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`

## Step-by-Step Solution

### Step 1: Clear Browser Cache and Storage

The issue may be stale data or cached errors. Clear everything:

**In Chrome/Edge:**
1. Open DevTools (F12)
2. Go to **Application** tab
3. Under **Storage**, click **Clear site data**
4. Check all boxes:
   - ✅ Cookies and other site data
   - ✅ Cached images and files
   - ✅ Storage (Local storage, Session storage)
5. Click **Clear site data**
6. Close DevTools

**Or use browser shortcut:**
- Press `Ctrl+Shift+Delete`
- Select "Cookies and other site data" and "Cached images and files"
- Click Clear data

### Step 2: Restart Frontend Service

```bash
# Stop the frontend if it's running
# Press Ctrl+C in the terminal where pnpm dev is running

# Restart frontend
cd D:\CCW-ERP-CRM
pnpm dev --filter=web
```

### Step 3: Navigate to Login Page

Open a **NEW BROWSER TAB** (to ensure clean state):
```
http://localhost:3006/login
```

### Step 4: Login with Demo Credentials

- **Email**: `admin@demo.com`
- **Password**: `demo123`

### Step 5: Verify Connection in Browser DevTools

After clicking "Sign In":

1. Open DevTools (F12)
2. Go to **Network** tab
3. Look for request to `http://localhost:8000/api/auth/login`
4. Check:
   - ✅ Status should be **200 OK**
   - ✅ Response should contain `access_token`
   - ✅ No CORS errors

5. Go to **Application** tab → **Local Storage** → `http://localhost:3006`
6. Check:
   - ✅ Should see `auth_token` key with JWT value

### Step 6: Access Dashboard

After successful login:
- You should be automatically redirected to: `http://localhost:3006/dashboard`
- Dashboard should load all data without "Failed to fetch" errors

---

## Troubleshooting: If Login Still Fails

### Issue 1: CORS Error in Console

**Symptom**: Console shows `CORS policy: No 'Access-Control-Allow-Origin' header`

**Fix**:
```bash
# Restart backend to reload CORS settings
cd D:\CCW-ERP-CRM\apps\backend
uv run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

### Issue 2: Network Error / Failed to Fetch

**Symptom**: Console shows `TypeError: Failed to fetch` or `Network request failed`

**Possible Causes**:
1. Backend not running
2. Firewall blocking localhost connections
3. Wrong port

**Fix**:
```bash
# Verify backend is running
curl http://localhost:8000/health

# Should return:
# {"api":"healthy","database":"healthy","timestamp":"...","status":"healthy","version":"1.0.0"}

# If not running, start backend:
cd D:\CCW-ERP-CRM\apps\backend
uv run uvicorn src.api.main:app --reload
```

### Issue 3: 401 Unauthorized on Dashboard

**Symptom**: Login succeeds but dashboard shows 401 errors

**Fix**: Clear localStorage and login again
```javascript
// Open browser console (F12 → Console tab) and run:
localStorage.clear();
window.location.href = '/login';
```

---

## Manual Connection Test

Test the full flow manually:

### Test 1: Backend Health
```bash
curl http://localhost:8000/health
```
**Expected**: `{"status":"healthy"}`

### Test 2: Login Endpoint
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```
**Expected**: JSON with `access_token` and `user` object

### Test 3: Dashboard Endpoint with Token
```bash
# First get token from Test 2, then:
TOKEN="your_token_here"

curl http://localhost:8000/api/dashboard/aggregated \
  -H "Authorization: Bearer $TOKEN"
```
**Expected**: Dashboard data with metrics, charts, etc.

---

## Alternative: Use Direct API Test Page

If browser issues persist, I can create a simple test page that bypasses Next.js routing.

Create `apps/web/public/test-connection.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <title>API Connection Test</title>
</head>
<body>
    <h1>Backend Connection Test</h1>
    <button onclick="testHealth()">Test Health</button>
    <button onclick="testLogin()">Test Login</button>
    <button onclick="testDashboard()">Test Dashboard</button>
    <pre id="output"></pre>

    <script>
        const API_URL = 'http://localhost:8000';
        const output = document.getElementById('output');

        async function testHealth() {
            try {
                const response = await fetch(`${API_URL}/health`);
                const data = await response.json();
                output.textContent = 'Health Check: ' + JSON.stringify(data, null, 2);
            } catch (error) {
                output.textContent = 'Health Check Error: ' + error.message;
            }
        }

        async function testLogin() {
            try {
                const response = await fetch(`${API_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'admin@demo.com',
                        password: 'demo123'
                    })
                });
                const data = await response.json();
                localStorage.setItem('auth_token', data.access_token);
                output.textContent = 'Login Success: ' + JSON.stringify(data, null, 2);
            } catch (error) {
                output.textContent = 'Login Error: ' + error.message;
            }
        }

        async function testDashboard() {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                output.textContent = 'Error: No token. Run Test Login first.';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/dashboard/aggregated`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                output.textContent = 'Dashboard Data: ' + JSON.stringify(data, null, 2);
            } catch (error) {
                output.textContent = 'Dashboard Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
```

Then access: `http://localhost:3006/test-connection.html`

---

## Quick Fix Checklist

- [ ] Backend running: `curl http://localhost:8000/health` returns healthy
- [ ] Frontend running: `http://localhost:3006` loads
- [ ] Browser cache cleared: All cookies, storage, cache cleared
- [ ] Opened NEW browser tab: To ensure clean state
- [ ] Navigated to login: `http://localhost:3006/login`
- [ ] Entered credentials: admin@demo.com / demo123
- [ ] Checked DevTools Network: Login request shows 200 OK
- [ ] Checked DevTools Application: `auth_token` in localStorage
- [ ] Dashboard loads: Redirected to /dashboard with data

---

## Expected Result After Fix

**Login Success:**
- ✅ Toast notification: "Welcome back, admin@demo.com!"
- ✅ Redirect to: http://localhost:3006/dashboard
- ✅ Dashboard loads in <2 seconds

**Dashboard Shows:**
- **22 products** in catalog
- **8 customers** registered
- **4 active orders** in progress
- **3 pending quotes** worth $376K+
- **$287,556** revenue in January 2026
- **Excavator 320D** as top product ($250K)

**All data loads in <100ms per endpoint** ⚡

---

## If Problem Persists

If after following all steps the issue persists, please provide:

1. **Browser Console Output** (F12 → Console tab)
   - Copy all red error messages
   - Include any warnings

2. **Network Tab** (F12 → Network tab)
   - Filter by "Fetch/XHR"
   - Show failed requests
   - Include request URL, status code, response

3. **Screenshots**
   - Login page
   - Error messages
   - DevTools Network/Console tabs

This will help diagnose the specific issue.
