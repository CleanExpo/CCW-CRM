# Semantic Search Implementation Guide

## Overview

CCW-Online ERP implements **pgvector-powered semantic search** using OpenAI embeddings for natural language product and customer discovery. This enables users to search using queries like "Find power tools under $500" instead of exact keyword matching.

## Architecture

### Tech Stack
- **Vector Database**: PostgreSQL 15 with pgvector extension
- **Embedding Model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Search Types**: Semantic (vector-only), Hybrid (vector + keyword), Keyword (traditional)
- **Frontend**: Next.js 15 with React hooks for real-time search
- **Backend**: FastAPI with async SQLAlchemy

### Database Schema

#### Products Table
```sql
ALTER TABLE products
ADD COLUMN embedding vector(1536);

CREATE INDEX ix_products_embedding
ON products
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### Customers Table
```sql
ALTER TABLE customers
ADD COLUMN embedding vector(1536);

CREATE INDEX ix_customers_embedding
ON customers
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Embedding Generation

Embeddings are generated from structured text representations:

**Products:**
```
Product: {name} | SKU: {sku} | Category: {category} | Description: {description} | Price: ${price} | In stock
```

**Customers:**
```
Company: {company_name} | Contact: {contact_name} | Address: {address} | City: {city} | State: {state}
```

## Setup Instructions

### 1. Configure OpenAI API Key

Add to `apps/backend/.env`:
```bash
OPENAI_API_KEY=sk-proj-...your-key-here
```

### 2. Run Database Migration

```bash
cd apps/backend
python -m alembic upgrade head
```

This creates the `embedding` columns and IVFFlat indexes.

### 3. Generate Embeddings

#### Option A: CLI Script (Recommended for initial setup)
```bash
cd apps/backend
python -m scripts.generate_embeddings --type all

# Or individually:
python -m scripts.generate_embeddings --type products
python -m scripts.generate_embeddings --type customers

# Force regenerate existing:
python -m scripts.generate_embeddings --type all --force

# Check coverage:
python -m scripts.generate_embeddings --type status
```

#### Option B: API Endpoint (For on-demand generation)
```bash
# Batch generate all products
curl -X POST http://localhost:8000/api/embeddings/batch \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "products",
    "force_regenerate": false
  }'

# Generate single product
curl -X POST http://localhost:8000/api/embeddings/generate \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "product",
    "entity_id": "uuid-here",
    "force_regenerate": false
  }'

# Check coverage
curl http://localhost:8000/api/embeddings/coverage
```

### 4. Verify Embeddings

```bash
# Check coverage statistics
python -m scripts.generate_embeddings --type status

# Expected output:
# {
#   "products": {
#     "total": 100,
#     "with_embeddings": 100,
#     "coverage_percent": 100.0
#   },
#   "customers": {
#     "total": 50,
#     "with_embeddings": 50,
#     "coverage_percent": 100.0
#   }
# }
```

## API Usage

### Search Products

```bash
# Semantic search (vector-only)
curl -X POST http://localhost:8000/api/search/ \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Find power tools under $500",
    "search_type": "semantic",
    "limit": 20
  }'

# Hybrid search (recommended - combines vector + keyword)
curl -X POST http://localhost:8000/api/search/ \
  -H "Content-Type: application/json" \
  -d '{
    "query": "drill for concrete",
    "search_type": "hybrid",
    "vector_weight": 0.7,
    "keyword_weight": 0.3,
    "limit": 20
  }'

# Keyword search (traditional)
curl -X POST http://localhost:8000/api/search/ \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SKU-001",
    "search_type": "keyword",
    "limit": 20
  }'
```

### Response Format

```json
{
  "success": true,
  "query": "power drill",
  "search_type": "hybrid",
  "results": {
    "query": "power drill",
    "type": "hybrid",
    "results": [
      {
        "product_id": "uuid-here",
        "sku": "SKU-001",
        "name": "Cordless Power Drill 20V",
        "description": "Professional grade drill with 2-speed transmission",
        "category": "POWER_TOOLS",
        "price": 299.99,
        "stock": 45,
        "similarity_score": 0.92,
        "keyword_score": 0.85,
        "combined_score": 0.89,
        "match_type": "hybrid"
      }
    ],
    "total": 15,
    "query_time_ms": 87
  }
}
```

## Frontend Integration

### React Hook for Search

```typescript
// apps/web/hooks/use-semantic-search.ts
import { useState } from 'react';
import { apiClient } from '@/lib/api/client';

export function useSemanticSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);

  async function search(query: string, searchType: 'semantic' | 'hybrid' | 'keyword' = 'hybrid') {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/search/', {
        query,
        search_type: searchType,
        limit: 20,
      });
      setResults(response.results);
      return response;
    } finally {
      setIsLoading(false);
    }
  }

  return { search, results, isLoading };
}
```

### Component Usage

```tsx
// apps/web/app/(dashboard)/products/page.tsx
import { useSemanticSearch } from '@/hooks/use-semantic-search';

export default function ProductsPage() {
  const { search, results, isLoading } = useSemanticSearch();

  return (
    <div>
      <input
        type="text"
        placeholder="Search products..."
        onChange={(e) => search(e.target.value)}
      />
      {isLoading && <LoadingSpinner />}
      {results.map(product => (
        <ProductCard
          key={product.product_id}
          {...product}
          similarityScore={product.similarity_score}
        />
      ))}
    </div>
  );
}
```

## Performance Benchmarks

### Target Metrics
- **QPS (Queries Per Second)**: Target 471 QPS (as per AI Integration Guide 2026)
- **Query Latency**: < 200ms for p95
- **Embedding Generation**: ~100 products/minute (OpenAI API limit dependent)

### Optimization Strategies

1. **IVFFlat Index Tuning**
   ```sql
   -- Adjust lists parameter based on dataset size
   -- Formula: lists = SQRT(total_rows)
   -- Example for 10,000 products:
   CREATE INDEX ix_products_embedding
   ON products
   USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100);  -- SQRT(10000) = 100
   ```

2. **Query Result Caching**
   - Cache popular queries in Redis (TTL: 5 minutes)
   - Reduces embedding generation cost and improves latency

3. **Batch Embedding Generation**
   - Process 100 products at a time to avoid API rate limits
   - Use exponential backoff for retries

4. **Connection Pooling**
   - AsyncSession pool size: 20 connections
   - Prevents database bottlenecks

## Cost Analysis

### OpenAI API Costs

**Embedding Model**: text-embedding-3-small
- **Cost**: $0.00002 per 1K tokens
- **Average tokens per product**: ~100 tokens (SKU + name + description)
- **Average tokens per customer**: ~80 tokens (company + contact + address)

**Estimated Costs:**
- 1,000 products: ~100,000 tokens = **$0.002** (less than 1 cent)
- 10,000 products: ~1,000,000 tokens = **$0.02** (2 cents)
- 500 customers: ~40,000 tokens = **$0.0008** (less than 1 cent)

**Total Initial Setup** (1,000 products + 500 customers): **~$0.003 USD**

**Ongoing Costs:**
- New products: $0.000002 per product embedding
- New customers: $0.000001 per customer embedding
- Search queries: Embedding generation only (~$0.000002 per search)

**Note**: Embeddings are cached in the database. No regeneration cost unless data changes.

## Search Quality Metrics

### Evaluation Criteria

1. **Relevance**: Results match user intent
2. **Recall**: Finds all relevant products
3. **Precision**: Avoids irrelevant results
4. **Speed**: Query time < 200ms

### Hybrid Search Weights

Default weights (tuned for best results):
- **Vector Weight**: 0.7 (70% semantic similarity)
- **Keyword Weight**: 0.3 (30% exact keyword matching)

**When to adjust:**
- Increase keyword weight for SKU/code searches
- Increase vector weight for natural language queries

## Troubleshooting

### Issue: Embeddings not generating

**Check:**
1. OpenAI API key is set in `.env`
   ```bash
   python -c "from src.config import get_settings; print(get_settings().openai_api_key[:10])"
   ```
2. Internet connection is active
3. OpenAI API quota is not exceeded

### Issue: Search returns no results

**Check:**
1. Embeddings are generated
   ```bash
   python -m scripts.generate_embeddings --type status
   ```
2. pgvector extension is enabled
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```
3. Indexes are created
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename IN ('products', 'customers');
   ```

### Issue: Slow queries

**Solutions:**
1. Reduce `limit` parameter (20 is optimal)
2. Check index exists: `EXPLAIN ANALYZE SELECT ... ORDER BY embedding <=> ...`
3. Increase IVFFlat `lists` parameter for larger datasets

## Maintenance

### Re-generate Embeddings

When product/customer data changes significantly:
```bash
python -m scripts.generate_embeddings --type all --force
```

### Monitor Performance

```sql
-- Check average query time from analytics
SELECT
  AVG(query_time_ms) as avg_ms,
  query_type,
  COUNT(*) as total_searches
FROM search_queries
WHERE searched_at > NOW() - INTERVAL '24 hours'
GROUP BY query_type;
```

### Update OpenAI Model

If switching to a different embedding model (e.g., text-embedding-3-large):

1. Update `EMBEDDING_MODEL` in `semantic_search_service_v2.py`
2. Update `EMBEDDING_DIMENSIONS` to match model (3072 for large model)
3. Run migration to alter column dimensions
4. Regenerate all embeddings

## Future Enhancements

1. **Multi-language embeddings**: Generate embeddings for each translation
2. **Personalized search**: Use customer purchase history for relevance boosting
3. **Image embeddings**: CLIP model for visual product search
4. **Autocomplete**: Real-time suggestions as user types
5. **Search analytics dashboard**: Visualize popular queries and zero-result searches

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [AI Integration Guide 2026](./research/AI_INTEGRATION_GUIDE_2026.md)
- [Hybrid Search Best Practices](https://neon.com/guides/ai-embeddings-postgres-search)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review API logs: `apps/backend/logs/`
3. Contact development team via Slack

---

**Last Updated**: 2026-03-16
**Version**: 1.0.0
**Status**: ✅ Production Ready
