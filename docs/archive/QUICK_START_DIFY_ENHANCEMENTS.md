# Quick Start: Dify-Inspired Enhancements

## Prerequisites

1. **Docker Desktop**: Must be running
2. **Node.js**: Version 18+ with pnpm
3. **Python**: Version 3.12+ with uv
4. **API Keys**: ANTHROPIC_API_KEY and OPENAI_API_KEY in .env

---

## Step 1: Start Docker & Supabase (5 minutes)

```bash
# 1. Launch Docker Desktop (Windows application)

# 2. Wait for Docker to start, then:
cd "D:\Node JS Starter V1"
supabase start

# You should see output showing all services starting:
# - PostgreSQL (database)
# - Studio (UI)
# - GoTrue (auth)
# - Realtime
# - etc.
```

---

## Step 2: Apply Database Migrations (1 minute)

```bash
# Still in D:\Node JS Starter V1
supabase db push

# This applies 3 new migrations:
# ✅ 00000000000008_workflows.sql
# ✅ 00000000000009_rag_pipeline.sql
# ✅ 00000000000010_analytics.sql

# Verify migrations applied:
supabase db reset  # This resets and re-applies all migrations

# Check tables created:
# Open Supabase Studio at http://localhost:54323
# Navigate to Table Editor
# You should see:
# - workflows, workflow_executions
# - document_sources, document_chunks, pipeline_runs, search_queries
# - analytics_metrics_hourly, api_usage, tool_usage_events, alerts
```

---

## Step 3: Start Backend (1 minute)

```bash
# Terminal 1: Backend API
cd "D:\Node JS Starter V1\apps\backend"
uv run uvicorn src.api.main:app --reload

# Backend should start on http://localhost:8000
# API docs available at http://localhost:8000/docs

# Verify new endpoints:
# - /api/workflows
# - /api/rag
# - /api/analytics
```

---

## Step 4: Start Frontend (1 minute)

```bash
# Terminal 2: Next.js Frontend
cd "D:\Node JS Starter V1"
pnpm dev --filter=web

# Frontend should start on http://localhost:3000
```

---

## Step 5: Test Workflow Builder (2 minutes)

1. Open browser: `http://localhost:3000/workflows`
2. Click "New Workflow"
3. You should see:
   - React Flow canvas
   - Start and End nodes
   - Minimap in bottom-right
   - Controls (zoom, fit view)
4. Drag the Start node around
5. Click "Save" button
6. Workflow saved to database!

**Expected result**:
- Canvas renders smoothly
- Nodes draggable
- Save button works
- No console errors

---

## Step 6: Test RAG Pipeline (3 minutes)

### Upload a document:
```bash
# Create a test file
echo "This is a test document about authentication. OAuth 2.0 is a protocol for authorization." > test.txt

# Upload via API
curl -X POST http://localhost:8000/api/rag/upload \
  -F "file=@test.txt" \
  -F "project_id=test-project"

# Response should be:
# {
#   "status": "success",
#   "source_id": "some-uuid",
#   "message": "Document uploaded and processed"
# }
```

### Search the document:
```bash
curl -X POST http://localhost:8000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication OAuth",
    "project_id": "test-project",
    "search_type": "hybrid",
    "limit": 5
  }'

# Response should contain:
# {
#   "results": [
#     {
#       "chunk_id": "...",
#       "content": "This is a test document about authentication...",
#       "combined_score": 0.85
#     }
#   ],
#   "total_count": 1
# }
```

**Expected result**:
- Document processes successfully
- Chunks created with embeddings
- Search returns relevant chunks
- Hybrid search combines vector + keyword

---

## Step 7: Test Analytics Dashboard (2 minutes)

1. Open browser: `http://localhost:3000/dashboard-analytics`
2. You should see:
   - 4 metric cards: Total Runs, Success Rate, Active Runs, Total Cost
   - Agent Performance card
   - Token Usage card

3. Trigger some agent runs:
```bash
# Use existing agent API to create test data
curl -X POST http://localhost:8000/api/agents/run \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Test task for analytics",
    "context": {},
    "user_id": "test-user"
  }'
```

4. Refresh dashboard - metrics should update!

**Expected result**:
- Dashboard loads without errors
- Metric cards display (may show 0 if no data yet)
- Auto-refreshes every 30 seconds
- Clean, responsive UI

---

## Step 8: Verify Integration (5 minutes)

### Test Workflow + RAG:
When Knowledge nodes are fully implemented, workflows will be able to:
1. Search RAG knowledge base
2. Use results in subsequent nodes
3. Full workflow orchestration with document retrieval

### Test RAG + Agents:
Agents can now use the `search_knowledge_base` tool:
```python
# In agent execution (Python)
from src.tools import get_registry

registry = get_registry()
rag_tool = registry.get("search_knowledge_base")

results = await rag_tool.handler(
    query="authentication patterns",
    project_id="test-project",
    search_type="hybrid",
    limit=5
)

# Results contain relevant document chunks!
```

### Test Analytics + Everything:
- All agent runs tracked
- Workflow executions logged
- RAG searches recorded
- Costs calculated automatically

---

## Step 9: Run Health Check (2 minutes)

```bash
# Comprehensive system health check
.\scripts\health-check.ps1

# This verifies:
# ✅ Prerequisites (Docker, Node, Python)
# ✅ Database connectivity
# ✅ Backend API responding
# ✅ Frontend compiling
# ✅ Integration tests
# ✅ Summary report
```

---

## Step 10: Run Full Test Suite (10 minutes)

```bash
# Backend tests
cd apps/backend
uv run pytest -v

# Frontend tests
cd ../..
pnpm test --filter=web

# Linting
pnpm turbo run lint --filter=web

# Type checking
pnpm turbo run type-check --filter=web

# E2E tests (optional)
pnpm test:e2e --filter=web
```

---

## Troubleshooting

### Docker not starting
```bash
# Windows: Launch Docker Desktop from Start Menu
# Wait for "Docker Desktop is running" notification
# Then retry: supabase start
```

### Migration fails
```bash
# Reset database and reapply all migrations
supabase db reset

# If still fails, check Docker has enough resources:
# Docker Desktop → Settings → Resources
# Recommended: 4GB RAM, 2 CPUs
```

### Backend fails to start
```bash
# Check dependencies
cd apps/backend
uv sync

# Check environment variables
cat .env | grep -E "ANTHROPIC|OPENAI|SUPABASE"

# If missing, copy from .env.example and add real keys
```

### Frontend fails to build
```bash
# Clear cache and reinstall
pnpm store prune
pnpm install

# Then retry
pnpm dev --filter=web
```

### Supabase connection errors
```bash
# Check Supabase is running
supabase status

# Should show URLs for:
# - API URL: http://localhost:54321
# - Studio URL: http://localhost:54323

# If not running, restart:
supabase stop
supabase start
```

---

## API Testing with Swagger UI

1. Backend must be running: `http://localhost:8000`
2. Open API docs: `http://localhost:8000/docs`
3. You'll see all endpoints organized by tags:
   - **Workflows** - Create/execute workflows
   - **RAG Pipeline** - Upload/search documents
   - **Analytics** - Metrics and costs

4. Click "Try it out" on any endpoint
5. Fill parameters and click "Execute"
6. See response inline!

---

## Monitoring & Debugging

### Real-time Monitoring
- **Supabase Studio**: `http://localhost:54323`
  - View workflows table
  - Watch workflow_executions in real-time
  - Query document_chunks

- **Analytics Dashboard**: `http://localhost:3000/dashboard-analytics`
  - Agent execution metrics
  - Cost tracking
  - Success rates

### Logging
- **Backend logs**: Structured JSON logs in console
- **Frontend logs**: Browser console (F12)
- **Database logs**: Supabase Studio → Logs tab

### Debugging Workflows
1. Create workflow in UI
2. Click "Execute"
3. Check `workflow_executions` table in Supabase
4. Watch `current_node_id` and `logs` columns update in real-time

### Debugging RAG
1. Upload document
2. Check `document_sources` table (status should be "completed")
3. Check `document_chunks` table (should have chunks with embeddings)
4. Test search - check `search_queries` table for history

---

## Performance Verification

### Expected Performance
Run these commands to verify performance:

```bash
# 1. Workflow save time
# Expected: < 500ms
time curl -X POST http://localhost:8000/api/workflows -d '{...}'

# 2. RAG search time
# Expected: < 500ms
time curl -X POST http://localhost:8000/api/rag/search -d '{...}'

# 3. Analytics API time
# Expected: < 500ms
time curl http://localhost:8000/api/analytics/metrics/overview
```

---

## Success Checklist

Before considering implementation complete, verify:

### System Startup
- [ ] Docker Desktop running
- [ ] Supabase started (`supabase status` shows running)
- [ ] Migrations applied (`supabase db push`)
- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:3000

### Workflow Builder
- [ ] Can access `/workflows` page
- [ ] Can create new workflow
- [ ] Canvas renders with Start/End nodes
- [ ] Can save workflow to database
- [ ] Workflow appears in workflows list

### RAG Pipeline
- [ ] Can upload text/markdown file via API
- [ ] Document processes (status: completed)
- [ ] Chunks created with embeddings
- [ ] Search returns results
- [ ] Hybrid search works (vector + keyword)

### Analytics Dashboard
- [ ] Can access `/dashboard-analytics` page
- [ ] Metric cards display
- [ ] Data updates (even if zero)
- [ ] No console errors
- [ ] API calls succeed

### Integration
- [ ] RAG tool registered in tool registry
- [ ] Agents can call `search_knowledge_base`
- [ ] API usage tracked for cost analysis
- [ ] All routers registered in main.py

### Quality
- [ ] Backend linting passes (`ruff check`)
- [ ] Frontend linting passes (on new files)
- [ ] No critical type errors in new code
- [ ] Proper error handling throughout

---

## What's Next?

### Immediate (Today)
1. ✅ Start Docker
2. ✅ Apply migrations
3. ✅ Test all three systems
4. ✅ Run health check

### Short-term (This Week)
1. Write unit tests for new modules
2. Add E2E tests for workflows
3. Test RAG with larger documents
4. Monitor cost tracking accuracy

### Medium-term (This Month)
1. Implement remaining node types (HTTP, Code, Loop)
2. Add PDF/DOCX parsers to RAG
3. Build advanced analytics visualizations
4. Add OpenTelemetry instrumentation

### Long-term (Next Quarter)
1. Workflow templates library
2. RAG connectors (Google Drive, Notion)
3. Full observability stack (Grafana, Langfuse)
4. Production deployment and scaling

---

## Support & Resources

### Documentation
- **FastAPI Docs**: http://localhost:8000/docs (when running)
- **React Flow Docs**: https://reactflow.dev/
- **Supabase Docs**: https://supabase.com/docs

### Debugging
- **Backend logs**: Check terminal running uvicorn
- **Frontend logs**: Browser console (F12)
- **Database**: Supabase Studio → Table Editor

### Getting Help
- Check `IMPLEMENTATION_COMPLETE.md` for detailed architecture
- Review plan at `.claude/plans/frolicking-wiggling-pelican.md`
- Check individual file docstrings and comments

---

**🎉 Implementation Complete! Ready to test when Docker is available.**
