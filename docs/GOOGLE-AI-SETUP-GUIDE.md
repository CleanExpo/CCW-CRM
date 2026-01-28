# Google AI API Key Setup Guide

**Quick Start:** Get your CCW-Online ERP system integrated with Google AI in 5 minutes.

---

## Step 1: Get Your Google AI API Key

1. **Visit Google AI Studio:**
   - Go to: https://makersuite.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key:**
   - Click **"Create API Key"**
   - Select **"Create API key in new project"** (or choose existing project)
   - **Copy the API key** (you'll only see it once!)
   - Format: `AIzaSy...` (should start with `AIzaSy`)

3. **Important Notes:**
   - ✅ The API key is FREE for development/testing
   - ✅ Includes generous free tier: 15 requests/minute
   - ✅ Supports Gemini 1.5 Flash (fast), Gemini 1.5 Pro (powerful)
   - ⚠️ Keep this key secure - don't share it or commit to Git

---

## Step 2: Add API Key to Production Environment

**File:** `apps/backend/.env.production`

**Find this section:**
```bash
# ============================================
# Google AI API (Gemini)
# ============================================
# Get your API key from: https://makersuite.google.com/app/apikey
# Used exclusively for ALL Google AI API calls (text generation, embeddings, vision)
# SECURITY: Keep this key secure and rotate every 90 days
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

**Replace `your_google_ai_api_key_here` with your actual API key:**
```bash
GOOGLE_AI_API_KEY=AIzaSyABCDEF1234567890_your_actual_key_here
```

**Save the file.**

---

## Step 3: Verify Integration

**Run the test script:**
```bash
cd apps/backend
python test_google_ai_integration.py
```

**Expected output:**
```
============================================================
Google AI Integration Test
============================================================

[TEST 1] Importing Google AI client...
[PASS] Successfully imported Google AI client

[TEST 2] Initializing Google AI client...
[PASS] Client initialized successfully
        Default model: gemini-1.5-flash
        Max retries: 3
        Timeout: 30s

[TEST 3] Testing text generation...
[PASS] Text generation successful
        Response: Hello from Google AI!
        Model used: gemini-1.5-flash

[TEST 4] Testing embeddings generation...
[PASS] Embeddings generation successful
        Generated 2 embeddings
        Dimension: 768

[TEST 5] Testing convenience function...
[PASS] Convenience function works
        Response: Four

============================================================
[SUCCESS] All Google AI integration tests passed!
============================================================
```

---

## Step 4: Test API Endpoints

**Start your backend server:**
```bash
cd apps/backend
uv run uvicorn src.api.main:app --reload
```

**Test the health endpoint:**
```bash
curl http://localhost:8001/api/google-ai/health
```

**Expected response:**
```json
{
  "configured": true,
  "status": "ready",
  "default_model": "gemini-1.5-flash"
}
```

**Test text generation:**
```bash
curl -X POST http://localhost:8001/api/google-ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is AI?", "temperature": 0.7, "max_tokens": 100}'
```

**Expected response:**
```json
{
  "text": "AI (Artificial Intelligence) refers to...",
  "model": "gemini-1.5-flash",
  "prompt_length": 11,
  "response_length": 156
}
```

---

## Available API Endpoints

### 1. Health Check
- **Endpoint:** `GET /api/google-ai/health`
- **Purpose:** Check if Google AI is configured and operational
- **Auth:** Not required

### 2. Text Generation
- **Endpoint:** `POST /api/google-ai/generate`
- **Purpose:** Generate text using Google Gemini
- **Auth:** Optional (demo mode allows anonymous)
- **Request Body:**
  ```json
  {
    "prompt": "Your prompt here",
    "temperature": 0.7,
    "max_tokens": 1024,
    "model": "gemini-1.5-flash"
  }
  ```

### 3. Product Description Generation
- **Endpoint:** `POST /api/google-ai/product-description`
- **Purpose:** AI-powered product description generation
- **Auth:** Optional
- **Request Body:**
  ```json
  {
    "product_name": "Industrial Drill Press",
    "product_category": "Power Tools",
    "key_features": ["Heavy-duty", "Variable speed"],
    "target_audience": "Professional contractors",
    "tone": "professional"
  }
  ```

### 4. Text Embeddings
- **Endpoint:** `POST /api/google-ai/embeddings`
- **Purpose:** Generate embeddings for semantic search
- **Auth:** Optional
- **Request Body:**
  ```json
  {
    "texts": ["Product 1", "Product 2"],
    "model": "models/embedding-001"
  }
  ```

---

## Security Checklist

Before deploying to production:

- [ ] **API key is in `.env.production`** (not in code)
- [ ] **`.env.production` is in `.gitignore`** (verified)
- [ ] **API key is NOT committed to Git** (check: `git log -p | grep AIzaSy`)
- [ ] **Separate keys for dev/staging/prod** (recommended)
- [ ] **Rate limiting enabled** (in `main.py`)
- [ ] **API key rotation scheduled** (every 90 days)
- [ ] **Usage monitoring enabled** (Google Cloud Console)

---

## Troubleshooting

### Error: "Google AI API key not configured"

**Cause:** API key not set in environment

**Fix:**
1. Check `.env.production` file has `GOOGLE_AI_API_KEY=your_key`
2. Restart backend server to load new environment
3. Run test script to verify

### Error: "API key not valid"

**Cause:** Invalid or expired API key

**Fix:**
1. Verify key format starts with `AIzaSy`
2. Check for extra spaces/newlines in `.env` file
3. Generate new key from https://makersuite.google.com/app/apikey

### Error: "Quota exceeded"

**Cause:** Free tier limit reached (15 requests/minute)

**Fix:**
1. Wait for quota reset (usually resets every minute)
2. Implement caching to reduce API calls
3. Request quota increase in Google Cloud Console

### Error: "Safety filter blocked response"

**Cause:** Content triggered Google's safety filters

**Fix:**
1. Adjust your prompt to avoid triggering filters
2. Check `safety_ratings` in API response for details

---

## Cost Estimates

**Free Tier (No payment required):**
- 15 requests per minute
- Unlimited requests per day
- Gemini 1.5 Flash model
- Perfect for development and testing

**Paid Tier Pricing (if you upgrade):**
- Gemini 1.5 Flash: $0.000075 per 1K characters (input), $0.0003 per 1K characters (output)
- Gemini 1.5 Pro: $0.00125 per 1K characters (input), $0.005 per 1K characters (output)

**Example cost calculation:**
```
Prompt: "Generate product description" (30 chars)
Response: 200 chars

Flash cost = (30/1000 * $0.000075) + (200/1000 * $0.0003)
           = $0.0000023 + $0.00006
           = $0.0000623 per request
           ≈ $0.06 per 1,000 requests
```

---

## Usage Monitoring

**View usage in Google Cloud Console:**
1. Go to: https://console.cloud.google.com/
2. Navigate to: **APIs & Services** → **Dashboard**
3. Select: **Generative Language API**
4. View metrics:
   - Request count per day/hour
   - Error rate
   - Latency
   - Quota usage

**Enable alerts:**
- Set up budget alerts if using paid tier
- Configure quota alerts
- Monitor for unusual usage patterns

---

## Next Steps

After successful setup:

1. **Explore Use Cases:**
   - AI-powered product descriptions
   - Semantic product search (with embeddings)
   - Customer support chatbot
   - Invoice data extraction
   - Multi-language content generation

2. **Optimize Performance:**
   - Implement caching for repeated queries
   - Use Gemini Flash for simple tasks (faster, cheaper)
   - Use Gemini Pro for complex tasks (higher quality)

3. **Scale Up:**
   - Implement rate limiting per user
   - Add usage quotas per department
   - Build usage analytics dashboard

---

## Support

**Documentation:**
- Integration Guide: `docs/GOOGLE-API-INTEGRATION.md`
- Security Checklist: `docs/GOOGLE-API-SECURITY-CHECKLIST.md`
- Google AI Docs: https://ai.google.dev/docs

**Issues:**
- API key issues: Check `.env.production` and restart server
- Rate limits: Implement caching or request quota increase
- Safety filters: Adjust prompts, check safety ratings

---

**Setup Complete!** Your CCW-Online ERP system now has secure Google AI integration. 🎉
