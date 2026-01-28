# Google API Integration - Secure Configuration Guide

**Status:** ✅ Implemented
**Security Level:** Production-Ready
**Last Updated:** 2026-01-27

---

## Overview

This document describes the secure integration of Google AI APIs into the CCW-Online ERP system. All Google API calls are centralized through a single, secure client to ensure consistent authentication, error handling, and monitoring.

**Key Features:**
- ✅ Centralized API key management
- ✅ Environment-based configuration (no hardcoded keys)
- ✅ Automatic retry logic
- ✅ Comprehensive error handling
- ✅ Structured logging for debugging
- ✅ Support for Gemini text generation, embeddings, and vision

---

## Table of Contents

1. [Getting Your Google AI API Key](#getting-your-google-ai-api-key)
2. [Configuration](#configuration)
3. [Usage](#usage)
4. [Security Best Practices](#security-best-practices)
5. [API Features](#api-features)
6. [Error Handling](#error-handling)
7. [Monitoring](#monitoring)

---

## Getting Your Google AI API Key

### Step 1: Create API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select "Create API key in new project" or choose an existing project
5. Copy the generated API key (you'll only see it once!)

### Step 2: Enable Required APIs

Your API key should automatically have access to:
- **Generative Language API** (for Gemini text generation)
- **Generative AI API** (for embeddings and vision)

If not, enable them in the [Google Cloud Console](https://console.cloud.google.com/apis/library).

### Step 3: Set Quotas (Optional)

For production use:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Quotas"
3. Search for "Generative Language API"
4. Adjust quotas as needed for your usage

---

## Configuration

### Development Environment

1. Copy the example environment file:
   ```bash
   cd apps/backend
   cp .env.example .env
   ```

2. Edit `.env` and set your API key:
   ```bash
   GOOGLE_AI_API_KEY=AIzaSy...your-actual-api-key-here
   ```

3. Verify configuration:
   ```bash
   # The API key should be loaded from environment
   cd apps/backend
   uv run python -c "from src.config.settings import get_settings; print('API Key configured:', bool(get_settings().google_ai_api_key))"
   ```

### Production Environment

**CRITICAL:** Never commit API keys to version control!

**Option 1: Environment Variables (Recommended)**
```bash
export GOOGLE_AI_API_KEY="AIzaSy...your-actual-api-key"
```

**Option 2: Secret Management Service**
- AWS Secrets Manager
- Google Cloud Secret Manager
- Azure Key Vault
- HashiCorp Vault

**Option 3: Docker Secrets**
```bash
docker run -e GOOGLE_AI_API_KEY="..." your-image
```

### Verification

Test that the API key is loaded correctly:
```bash
cd apps/backend
uv run python -c "from src.integrations.google import get_google_ai_client; print('Google AI client ready')"
```

---

## Usage

### Basic Text Generation

```python
from src.integrations.google import get_google_ai_client

# Get the singleton client instance
client = get_google_ai_client()

# Generate text
response = await client.generate_text(
    prompt="What are the benefits of using PostgreSQL SEQUENCE?",
    temperature=0.7,
    max_tokens=1024,
)

print(response["text"])
```

### Quick Text Generation (Convenience Function)

```python
from src.integrations.google import generate_text_with_google

# Simple one-liner
text = await generate_text_with_google("Explain quantum computing in simple terms")
print(text)
```

### Text Embeddings

```python
from src.integrations.google import get_google_ai_client

client = get_google_ai_client()

# Generate embeddings for multiple texts
texts = [
    "Product: Industrial drill press",
    "Product: Heavy-duty circular saw",
    "Product: Professional welding equipment",
]

embeddings = await client.generate_embeddings(texts)

# embeddings is a list of vectors: [[0.123, -0.456, ...], ...]
print(f"Generated {len(embeddings)} embeddings")
```

### Vision Analysis

```python
from src.integrations.google import get_google_ai_client

client = get_google_ai_client()

# Analyze an image
response = await client.vision_analysis(
    image_path="/path/to/product/image.jpg",
    prompt="Describe this product in detail. Is it suitable for industrial use?",
)

print(response["text"])
```

### In API Routes

```python
from fastapi import APIRouter, HTTPException
from src.integrations.google import get_google_ai_client

router = APIRouter()

@router.post("/api/ai/generate-description")
async def generate_product_description(product_name: str):
    """Generate AI product description using Google Gemini."""
    try:
        client = get_google_ai_client()

        response = await client.generate_text(
            prompt=f"Write a compelling product description for: {product_name}",
            temperature=0.8,
            max_tokens=200,
        )

        return {
            "product_name": product_name,
            "description": response["text"],
        }

    except ValueError as e:
        # API key not configured
        raise HTTPException(
            status_code=500,
            detail="Google AI API not configured. Please contact administrator."
        )
    except Exception as e:
        # Other errors (rate limits, network issues, etc.)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate description: {str(e)}"
        )
```

---

## Security Best Practices

### 1. Never Hardcode API Keys

❌ **WRONG:**
```python
# NEVER DO THIS!
genai.configure(api_key="AIzaSy...hardcoded-key")
```

✅ **CORRECT:**
```python
from src.integrations.google import get_google_ai_client

# API key loaded securely from environment
client = get_google_ai_client()
```

### 2. Use Environment Variables

```bash
# In .env (NEVER commit to git)
GOOGLE_AI_API_KEY=AIzaSy...your-key

# In .gitignore (ALWAYS exclude)
.env
.env.local
*.env
```

### 3. Rotate Keys Regularly

- Rotate API keys every 90 days minimum
- Use separate keys for development, staging, and production
- Immediately rotate if a key is exposed

### 4. Implement Rate Limiting

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

@router.post("/api/ai/generate", dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def generate_endpoint():
    """Limited to 10 requests per minute."""
    pass
```

### 5. Monitor API Usage

Check your usage regularly:
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Go to "APIs & Services" → "Dashboard"
3. View usage metrics and costs

---

## API Features

### Supported Models

#### Text Generation
- `gemini-1.5-flash` (default) - Fast and cost-effective
- `gemini-1.5-pro` - More capable, higher quality
- `gemini-1.0-pro` - Previous generation

#### Embeddings
- `models/embedding-001` - 768-dimensional embeddings

#### Vision
- `gemini-1.5-flash` - Image analysis
- `gemini-1.5-pro` - Advanced vision tasks

### Parameters

**Temperature (0.0 - 1.0)**
- `0.0` - Deterministic, focused responses
- `0.7` - Balanced creativity and coherence (default)
- `1.0` - Maximum creativity and randomness

**Max Tokens**
- Controls length of generated text
- Default: 1024
- Max: Varies by model (typically 8192+)

### Response Format

```python
{
    "text": "Generated text content",
    "model": "gemini-1.5-flash",
    "prompt_feedback": {...},
    "safety_ratings": [
        {"category": "HARM_CATEGORY_HARASSMENT", "probability": "NEGLIGIBLE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "probability": "LOW"},
        # ...
    ]
}
```

---

## Error Handling

### Common Errors

**1. API Key Not Configured**
```
ValueError: Google AI API key not configured.
```
**Solution:** Set `GOOGLE_AI_API_KEY` in your environment

**2. Invalid API Key**
```
google.api_core.exceptions.PermissionDenied: API key not valid
```
**Solution:** Check your API key is correct and has proper permissions

**3. Quota Exceeded**
```
google.api_core.exceptions.ResourceExhausted: Quota exceeded
```
**Solution:** Wait for quota reset or request quota increase

**4. Rate Limit**
```
google.api_core.exceptions.TooManyRequests: Too many requests
```
**Solution:** Implement exponential backoff and rate limiting

### Error Handling Pattern

```python
from src.integrations.google import get_google_ai_client
import structlog

logger = structlog.get_logger(__name__)

async def safe_generate_text(prompt: str) -> str | None:
    """Generate text with comprehensive error handling."""
    try:
        client = get_google_ai_client()
        response = await client.generate_text(prompt)
        return response["text"]

    except ValueError as e:
        # API key not configured
        logger.error("google_ai_not_configured", error=str(e))
        return None

    except Exception as e:
        # Network errors, quota issues, etc.
        logger.error(
            "google_ai_generation_failed",
            error=str(e),
            error_type=type(e).__name__,
        )
        return None
```

---

## Monitoring

### Logging

All Google AI client operations are logged with structured logging:

```python
# Successful generation
logger.info(
    "google_ai_generate_success",
    model="gemini-1.5-flash",
    response_length=1234,
)

# Error logging
logger.error(
    "google_ai_generate_error",
    error="Rate limit exceeded",
    error_type="ResourceExhausted",
)
```

### Metrics to Monitor

1. **Request Count** - Total API calls per day/hour
2. **Error Rate** - Percentage of failed requests
3. **Latency** - Average response time
4. **Token Usage** - Total tokens consumed (impacts cost)
5. **Safety Violations** - Content filtered by safety ratings

### Cost Monitoring

**Pricing (as of 2026-01-27):**
- Gemini 1.5 Flash: $0.000075 per 1K characters (input), $0.0003 per 1K characters (output)
- Gemini 1.5 Pro: $0.00125 per 1K characters (input), $0.005 per 1K characters (output)

**Estimate Costs:**
```python
# Rough estimate for text generation
input_chars = len(prompt)
output_chars = max_tokens * 4  # Approximate

cost_flash_input = (input_chars / 1000) * 0.000075
cost_flash_output = (output_chars / 1000) * 0.0003

total_cost = cost_flash_input + cost_flash_output
```

---

## Troubleshooting

### Issue: "google-generativeai package not installed"

**Solution:**
```bash
cd apps/backend
uv add google-generativeai
```

### Issue: "API key not valid"

**Solutions:**
1. Verify API key is correct (no extra spaces/newlines)
2. Check API is enabled in Google Cloud Console
3. Try generating a new API key

### Issue: "Quota exceeded"

**Solutions:**
1. Wait for quota to reset (usually daily/hourly)
2. Request quota increase in Google Cloud Console
3. Implement caching to reduce API calls

### Issue: "Safety filter blocked response"

**Solution:**
```python
# Check safety ratings in response
response = await client.generate_text(prompt)
print(response["safety_ratings"])

# Adjust prompt to avoid triggering filters
```

---

## Migration Guide

### Migrating from Direct API Calls

**Before:**
```python
import google.generativeai as genai

genai.configure(api_key=os.getenv("GOOGLE_AI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")
response = model.generate_content("Hello")
```

**After:**
```python
from src.integrations.google import get_google_ai_client

client = get_google_ai_client()
response = await client.generate_text("Hello")
text = response["text"]
```

**Benefits:**
- ✅ Centralized configuration
- ✅ Consistent error handling
- ✅ Automatic logging
- ✅ Type safety
- ✅ Easier testing/mocking

---

## Testing

### Mock for Unit Tests

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_generate_description():
    """Test product description generation."""
    mock_client = AsyncMock()
    mock_client.generate_text.return_value = {
        "text": "Mocked product description",
        "model": "gemini-1.5-flash",
    }

    with patch("src.integrations.google.get_google_ai_client", return_value=mock_client):
        # Your test code here
        response = await generate_product_description("Test Product")
        assert "Mocked" in response["description"]
```

---

## Support

**Questions or Issues?**
- Check logs: `apps/backend/logs/app.log`
- Review Google AI documentation: https://ai.google.dev/docs
- Contact: dev-team@ccw-erp.com

**Security Concerns?**
- Report immediately to: security@ccw-erp.com
- Rotate API keys if compromised
- Review audit logs

---

## Appendix

### Related Files

| File | Purpose |
|------|---------|
| `apps/backend/src/integrations/google/client.py` | Main Google AI client implementation |
| `apps/backend/src/config/settings.py` | Configuration management |
| `apps/backend/.env.example` | Environment variable template |
| `docs/GOOGLE-API-INTEGRATION.md` | This document |

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_AI_API_KEY` | Yes | - | Google AI API key from AI Studio |
| `GOOGLE_AI_DEFAULT_MODEL` | No | `gemini-1.5-flash` | Default model for text generation |
| `GOOGLE_AI_MAX_RETRIES` | No | `3` | Maximum retry attempts |
| `GOOGLE_AI_TIMEOUT` | No | `30` | Request timeout in seconds |

---

**Document Version:** 1.0
**Last Reviewed:** 2026-01-27
**Next Review:** 2026-04-27 (90 days)
