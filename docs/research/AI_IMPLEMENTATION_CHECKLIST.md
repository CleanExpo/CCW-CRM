# AI Integration Implementation Checklist

Quick reference for implementing AI features in CCW-Online ERP based on research findings.

---

## Pre-Implementation Setup

### Infrastructure Setup
- [ ] Add pgvector extension to PostgreSQL
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Create embeddings table
  ```sql
  CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY,
    product_id UUID REFERENCES products(id),
    embedding vector(1536),
    model VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX ON product_embeddings USING ivfflat (embedding vector_cosine_ops);
  ```
- [ ] Set up API keys (environment variables)
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `OLLAMA_BASE_URL` (if using local models)

### Cost Management Setup
- [ ] Create token usage tracking table
  ```sql
  CREATE TABLE ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    feature VARCHAR(50),
    model VARCHAR(50),
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_tokens INTEGER DEFAULT 0,
    cost DECIMAL(10, 6),
    timestamp TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Implement usage tracking middleware
- [ ] Set up monthly quota alerts
- [ ] Create usage dashboard for admin

### Compliance Setup (GDPR)
- [ ] Conduct DPIA for AI features
- [ ] Implement data minimization (filter data sent to APIs)
- [ ] Add AI disclosure labels to UI
- [ ] Create equal-weight consent UI for optional AI features
- [ ] Document legal basis for AI processing
- [ ] Implement data deletion for AI-generated content

---

## Phase 1: Foundation (Months 1-2)

### 1. Multi-Model Router
**Priority: High | Effort: Low**

- [ ] Create AI provider interface
  ```typescript
  // lib/ai/types.ts
  export interface AIProvider {
    complete(prompt: string, options: CompletionOptions): Promise<AIResponse>;
  }
  ```
- [ ] Implement OpenAI provider
- [ ] Implement Claude provider
- [ ] Implement Ollama provider (optional)
- [ ] Create router function
  ```typescript
  export function getAIProvider(taskType: TaskType): AIProvider
  ```
- [ ] Add provider tests

**Success Criteria**: Can swap providers without changing application code

---

### 2. Prompt Caching
**Priority: High | Effort: Low**

#### OpenAI (Automatic Caching)
- [ ] Structure prompts: static content first, variable last
- [ ] Test cache hit rates in logs
- [ ] Verify 50-90% cost reduction on repeated calls

#### Claude (Explicit Caching)
- [ ] Add `cache_control` to static prompt sections
  ```typescript
  {
    type: "text",
    text: "Static system instructions...",
    cache_control: { type: "ephemeral" }
  }
  ```
- [ ] Monitor `usage.cache_read_input_tokens` in responses
- [ ] Verify 90% cost reduction on cached sections

**Success Criteria**: 40-60% overall cost reduction on AI features

---

### 3. pgvector Semantic Search
**Priority: High | Effort: Medium**

#### Backend Setup
- [ ] Install pgvector extension
- [ ] Create embeddings migration
- [ ] Build embedding generation script
  ```bash
  pnpm run generate-embeddings --table=products
  ```
- [ ] Create hybrid search API endpoint
  ```typescript
  // apps/backend/src/api/routes/search.py
  @router.get("/search/semantic")
  async def semantic_search(query: str, limit: int = 20)
  ```

#### Frontend Integration
- [ ] Add natural language search bar to products page
- [ ] Add toggle: "Keyword" vs "Smart Search"
- [ ] Show similarity scores in results
- [ ] Add "Did you mean?" suggestions for low-confidence matches

**Success Criteria**:
- 30% reduction in "can't find product" support tickets
- <500ms search response time
- >80% user satisfaction with results

---

## Phase 2: High-Value Features (Months 3-4)

### 4. AI-Powered Quote Generation
**Priority: High | Effort: Medium**

- [ ] Design quote generation prompt template
- [ ] Implement streaming response
  ```typescript
  // lib/ai/quote.ts
  export async function* streamQuoteGeneration(
    productIds: string[],
    customerId: string
  ): AsyncGenerator<QuoteChunk>
  ```
- [ ] Add quote generator UI component
  - [ ] Loading state with skeleton
  - [ ] Streaming text display
  - [ ] Confidence score indicator
  - [ ] Regenerate button
  - [ ] Edit before accept
- [ ] Integrate with existing quote workflow
- [ ] Add GDPR disclosure: "This quote was AI-generated"

**Success Criteria**:
- 50% faster quote turnaround
- >85% acceptance rate (not regenerated)
- <$500/month API costs

---

### 5. Natural Language Filters
**Priority: High | Effort: Medium**

- [ ] Build NL → SQL converter
  ```typescript
  // lib/ai/nl-to-sql.ts
  export async function naturalLanguageToFilter(
    query: string,
    schema: TableSchema
  ): Promise<SQLFilter>
  ```
- [ ] Add validation layer (prevent SQL injection)
- [ ] Add natural language input to:
  - [ ] Products list page
  - [ ] Customers list page
  - [ ] Orders list page
  - [ ] Quotes list page
- [ ] Add example queries UI
  - "Orders from last month over $5000"
  - "Customers in Sydney who haven't ordered in 90 days"
  - "Low stock products in power tools category"

**Success Criteria**:
- 20% increase in self-service filtering
- <3% invalid query rate
- <$200/month API costs

---

### 6. Document OCR and Extraction
**Priority: High | Effort: High**

- [ ] Set up file upload endpoint
- [ ] Implement Claude API document extraction
  ```typescript
  // lib/ai/document.ts
  export async function extractInvoiceData(
    fileBuffer: Buffer
  ): Promise<InvoiceData>
  ```
- [ ] Build document upload UI
  - [ ] Drag-and-drop zone
  - [ ] Processing status
  - [ ] Extracted data preview
  - [ ] Edit before accept
- [ ] Auto-match extracted products to catalog
- [ ] Create order/quote from extracted data

**Success Criteria**:
- 80% reduction in manual data entry time
- >90% extraction accuracy
- <$600/month API costs

---

## Phase 3: Predictive Features (Months 5-6)

### 7. Predictive Inventory Alerts
**Priority: Medium | Effort: High**

- [ ] Collect historical data (6+ months)
  - [ ] Stock levels over time
  - [ ] Order patterns
  - [ ] Seasonal trends
- [ ] Train prediction model (or use OpenAI for pattern analysis)
- [ ] Build alert system
  - [ ] Low stock predictions (7/14/30 day forecast)
  - [ ] Reorder quantity suggestions
  - [ ] Optimal reorder timing
- [ ] Add dashboard widget
- [ ] Add email/SMS notifications

**Success Criteria**:
- 15% reduction in stockouts
- >70% prediction accuracy
- <$300/month costs

---

### 8. Customer Insights and Recommendations
**Priority: Medium | Effort: Medium**

- [ ] Build recommendation engine
  ```typescript
  // lib/ai/recommendations.ts
  export async function getProductRecommendations(
    customerId: string
  ): Promise<Product[]>
  ```
- [ ] Add "Frequently Bought Together" to product pages
- [ ] Add "Customers Also Bought" to order review
- [ ] Add "Recommended for You" to customer dashboard
- [ ] Track conversion rate from recommendations

**Success Criteria**:
- 10-15% increase in average order value
- >5% recommendation click-through rate
- <$400/month costs

---

## Phase 4: Advanced Features (Months 7-9)

### 9. RAG-Powered Knowledge Base
**Priority: Low | Effort: High**

- [ ] Index documentation
  - [ ] Product specs
  - [ ] Policies
  - [ ] FAQs
  - [ ] User guides
- [ ] Build RAG pipeline
  - [ ] Chunking strategy (semantic, not fixed-size)
  - [ ] Embedding generation
  - [ ] Retrieval with hybrid search
  - [ ] Response generation with source citations
- [ ] Create chatbot UI
  - [ ] Embedded in support pages (not sidebar)
  - [ ] Show source documents
  - [ ] Escalate to human option
- [ ] Implement evaluation (RAGAS metrics)

**Success Criteria**:
- 30% reduction in support response time
- >80% answer accuracy
- <$1000/month costs

---

### 10. Adaptive UI Personalization
**Priority: Low | Effort: High**

- [ ] Track feature usage per user
  ```typescript
  // Track in analytics
  trackEvent('feature_used', {
    userId,
    feature: 'products_list',
    timestamp: new Date()
  });
  ```
- [ ] Build personalization engine
  - [ ] Identify frequently used features
  - [ ] Hide rarely used features
  - [ ] Reorganize dashboard widgets
- [ ] Create "Reset to Default" option
- [ ] A/B test personalization impact

**Success Criteria**:
- 20% increase in feature adoption
- >60% users keep personalized layout
- <$100/month costs

---

## Ongoing Monitoring

### Cost Monitoring
- [ ] Weekly token usage review
- [ ] Monthly cost vs. budget comparison
- [ ] Alert if cost increases >20% week-over-week
- [ ] Quarterly optimization review

### Performance Monitoring
- [ ] Track API latency (p50, p95, p99)
- [ ] Monitor cache hit rates
- [ ] Track error rates by provider
- [ ] Set up alerts for degraded performance

### Quality Monitoring
- [ ] Collect user feedback on AI outputs
- [ ] Track regeneration rates (indicates low quality)
- [ ] Monitor confidence score distributions
- [ ] Quarterly accuracy audits

### Compliance Monitoring
- [ ] Quarterly GDPR compliance review
- [ ] Track data minimization (tokens sent to APIs)
- [ ] Monitor consent rates
- [ ] Update privacy policy when adding features

---

## Testing Checklist

### Unit Tests
- [ ] AI provider implementations
- [ ] Prompt caching logic
- [ ] Natural language parsing
- [ ] Cost calculation functions

### Integration Tests
- [ ] End-to-end semantic search
- [ ] Quote generation workflow
- [ ] Document extraction pipeline
- [ ] Recommendation engine

### Load Tests
- [ ] Concurrent AI requests (10, 50, 100)
- [ ] Cache performance under load
- [ ] Fallback behavior when API rate-limited

### Security Tests
- [ ] SQL injection prevention (NL filters)
- [ ] Prompt injection attacks
- [ ] Data leakage between organizations
- [ ] API key rotation

---

## Launch Checklist

### Pre-Launch
- [ ] GDPR DPIA approved
- [ ] Legal review of AI disclosures
- [ ] Privacy policy updated
- [ ] User documentation written
- [ ] Internal training completed
- [ ] Monitoring dashboards configured
- [ ] Budget alerts configured
- [ ] Rollback plan documented

### Launch
- [ ] Deploy to staging
- [ ] Beta test with 10 users
- [ ] Fix critical bugs
- [ ] Deploy to production (5% traffic)
- [ ] Monitor for 48 hours
- [ ] Increase to 25% traffic
- [ ] Monitor for 1 week
- [ ] Increase to 100% traffic

### Post-Launch
- [ ] Week 1: Daily monitoring
- [ ] Week 2-4: Every other day monitoring
- [ ] Month 2+: Weekly monitoring
- [ ] Collect user feedback
- [ ] Measure ROI metrics
- [ ] Document lessons learned
- [ ] Plan next phase

---

## Success Metrics Dashboard

Create a dashboard tracking:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Cost** |
| Monthly AI spend | <$2000 | $— | 🟢 |
| Cost per feature | <$500 | $— | 🟢 |
| Cache hit rate | >50% | —% | 🟡 |
| **Performance** |
| Search response time | <500ms | —ms | 🟢 |
| Quote generation time | <10s | —s | 🟢 |
| API error rate | <1% | —% | 🟢 |
| **Adoption** |
| Semantic search usage | >30% users | —% | 🟡 |
| Quote generator usage | >50% quotes | —% | 🟡 |
| NL filter usage | >20% searches | —% | 🟡 |
| **Quality** |
| Search satisfaction | >80% | —% | 🟢 |
| Quote acceptance rate | >85% | —% | 🟢 |
| Document extraction accuracy | >90% | —% | 🟢 |
| **ROI** |
| Time saved per user | >10h/mo | —h | 🟡 |
| Support ticket reduction | >30% | —% | 🟡 |
| Order value increase | >10% | —% | 🟡 |

---

## Emergency Procedures

### If API Costs Spike
1. Check token usage logs for anomalies
2. Verify caching is working
3. Temporarily disable non-critical AI features
4. Implement emergency rate limits
5. Review and optimize prompts

### If Quality Degrades
1. Check model version (provider may have updated)
2. Review recent prompt changes
3. Test with known-good examples
4. Roll back to previous version
5. Contact provider support

### If API Goes Down
1. Verify fallback to manual workflows
2. Display clear error message to users
3. Log all failed requests for retry
4. Monitor provider status page
5. Communicate ETA to users

---

## Resource Links

- Main research document: `/docs/research/AI_INTEGRATION_GUIDE_2026.md`
- OpenAI API docs: https://platform.openai.com/docs
- Claude API docs: https://platform.claude.com/docs
- pgvector docs: https://github.com/pgvector/pgvector
- RAGAS evaluation: https://github.com/explodinggradients/ragas
- GDPR AI guidance: https://www.cnil.fr/en/ai-system-development-cnils-recommendations-to-comply-gdpr
