# Marketing Addon Integration Plan

**Date:** January 15, 2026
**Objective:** Integrate unique features from NodeJS-Starter-V1 (marketing-addon) into CCW-Online ERP

---

## Executive Summary

The marketing addon (NodeJS-Starter-V1) contains several valuable features that complement CCW-Online ERP's capabilities. This plan outlines the integration of:

1. **PRD Generation System** - AI-powered Product Requirements Document generation
2. **Usage Tracking/Telemetry** - API cost tracking for AI models
3. **Continuous Improvement Workflows** - Automated codebase monitoring
4. **Agent Runs Dashboard** - UI for tracking agent execution history

These features will enhance CCW-ERP's AI capabilities without duplicating existing functionality.

---

## Analysis Results

### Features to Integrate

#### 1. PRD Generation System (HIGH PRIORITY)

**Location:** `marketing-addon/apps/backend/src/agents/prd/`

**Components:**
- `prd_orchestrator.py` - Coordinates all PRD agents
- `analysis_agent.py` - Requirements analysis
- `feature_decomposer.py` - Breaks down features into user stories
- `tech_spec_generator.py` - Generates technical specifications
- `test_generator.py` - Creates test plans
- `roadmap_planner.py` - Implementation roadmap planning

**Value Proposition:**
- Generates comprehensive PRDs from plain English requirements
- Creates user stories, technical specs, test plans, and roadmaps
- Uses Claude Opus 4.5 for high-quality outputs
- Outputs include: PRD document, user stories, API specs, test plan, roadmap, feature_list.json

**Integration Target:** `apps/backend/src/agents/prd/` (new directory)

**Frontend Components:**
- `/prd/generate` - PRD generation form
- `/prd/[id]` - View generated PRD
- Components: PRDGeneratorForm, PRDGenerationProgress

**Integration Target:** `apps/frontend/src/pages/prd/` (new directory)

---

#### 2. Usage Tracking/Telemetry (MEDIUM PRIORITY)

**Location:** `marketing-addon/apps/backend/src/telemetry/`

**Components:**
- `usage_tracker.py` - Tracks API calls, token usage, and costs

**Features:**
- Tracks input/output tokens for each AI API call
- Calculates costs based on model pricing (Claude Opus, Sonnet, Haiku, OpenAI embeddings)
- Stores usage data in `api_usage` table
- Non-blocking (failures don't stop execution)

**Value Proposition:**
- Cost visibility for AI operations
- Budget tracking for different AI models
- Identify expensive operations

**Integration Target:** `apps/backend/src/telemetry/` (new directory)

**Database Changes Required:**
```sql
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_per_input_token DECIMAL(20, 10) NOT NULL,
    cost_per_output_token DECIMAL(20, 10) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

#### 3. Continuous Improvement Workflows (LOW PRIORITY)

**Location:** `marketing-addon/apps/backend/src/workflows/`

**Components:**
- `continuous_improvement.py` - Tech debt scanning, refactoring identification
- `pr_automation.py` - Automated PR creation (placeholder implementation)

**Features:**
- Scans for TODO/FIXME comments
- Identifies code smells
- Detects outdated dependencies
- Finds functions without docstrings
- Monitors performance regressions
- (Placeholder) Creates improvement PRs

**Value Proposition:**
- Proactive codebase health monitoring
- Identifies technical debt automatically
- Suggests refactoring opportunities

**Integration Target:** `apps/backend/src/workflows/` (new directory)

**Note:** Most functions are placeholders - would need full implementation

---

#### 4. Agent Runs Dashboard (MEDIUM PRIORITY)

**Location:** `marketing-addon/apps/web/app/dashboard/agent-runs/`

**Features:**
- View history of all agent executions
- Track long-running agent tasks
- Monitor progress and status
- View agent outputs and errors

**Value Proposition:**
- Visibility into AI agent operations
- Debugging and troubleshooting
- Performance monitoring

**Integration Target:** `apps/frontend/src/pages/dashboard/agent-runs/` (new directory)

**Database Changes Required:**
```sql
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    task_description TEXT,
    status TEXT NOT NULL, -- running, completed, failed
    progress INTEGER DEFAULT 0,
    current_step TEXT,
    outputs JSONB,
    error TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

---

### Features NOT to Integrate (Already in CCW-ERP)

1. **Authentication System** - CCW-ERP has JWT authentication with Clerk integration
2. **Database Setup** - CCW-ERP uses PostgreSQL with Alembic migrations
3. **Agent Base Classes** - CCW-ERP has its own agent architecture for ERP-specific agents
4. **Supabase Integration** - Marketing addon uses Supabase, CCW-ERP uses direct PostgreSQL

---

## Integration Steps

### Phase 1: Backend Foundation (Week 1)

#### Step 1.1: Copy PRD Agent Files
```bash
# Create new directory
mkdir -p "C:\CCW-Online ERP\apps\backend\src\agents\prd"

# Copy all PRD agent files
cp marketing-addon/apps/backend/src/agents/prd/*.py apps/backend/src/agents/prd/

# Update imports to match CCW-ERP structure
```

**Files to Copy:**
- `__init__.py`
- `analysis_agent.py`
- `feature_decomposer.py`
- `tech_spec_generator.py`
- `test_generator.py`
- `roadmap_planner.py`
- `prd_orchestrator.py`

**Import Changes Required:**
- Change `from src.config import get_settings` to match CCW-ERP paths
- Update `from ..base_agent import BaseAgent` to use CCW-ERP's agent base
- Replace `src.state.supabase` with direct PostgreSQL queries

#### Step 1.2: Create API Endpoints
**Location:** `apps/backend/src/api/routers/prd.py` (new file)

```python
from fastapi import APIRouter, Depends
from src.agents.prd.prd_orchestrator import PRDOrchestrator

router = APIRouter(prefix="/api/prd", tags=["prd"])

@router.post("/generate")
async def generate_prd(
    requirements: str,
    context: dict = None
):
    """Generate PRD from requirements."""
    orchestrator = PRDOrchestrator()
    result = await orchestrator.generate(requirements, context)
    return result

@router.get("/{prd_id}")
async def get_prd(prd_id: str):
    """Get generated PRD by ID."""
    # Fetch from database
    pass
```

#### Step 1.3: Database Migration
**Location:** `apps/backend/alembic/versions/XXX_add_prd_tables.py`

Create migration for:
- `prds` table - Stores generated PRD documents
- `api_usage` table - Tracks AI API costs
- `agent_runs` table - Tracks agent execution history

---

### Phase 2: Telemetry Integration (Week 1)

#### Step 2.1: Copy Telemetry Module
```bash
mkdir -p "C:\CCW-Online ERP\apps\backend\src\telemetry"
cp marketing-addon/apps/backend/src/telemetry/*.py apps/backend/src/telemetry/
```

#### Step 2.2: Integrate with Existing Agents
Update existing CCW-ERP agents to use usage tracker:

```python
from src.telemetry.usage_tracker import track_api_call

# In agent execution
await track_api_call(
    agent_run_id=run_id,
    provider="anthropic",
    model="claude-sonnet-4-5-20250929",
    input_tokens=response.usage.input_tokens,
    output_tokens=response.usage.output_tokens
)
```

---

### Phase 3: Frontend Integration (Week 2)

#### Step 3.1: Copy PRD Pages
```bash
mkdir -p "C:\CCW-Online ERP\apps\frontend\src\pages\prd"

# Copy pages
cp marketing-addon/apps/web/app/prd/generate/page.tsx apps/frontend/src/pages/prd/generate.tsx
cp marketing-addon/apps/web/app/prd/[id]/page.tsx apps/frontend/src/pages/prd/[id].tsx
```

#### Step 3.2: Copy PRD Components
```bash
# Copy reusable components
cp marketing-addon/apps/web/components/prd-generator-form.tsx apps/frontend/src/components/prd/
cp marketing-addon/apps/web/components/prd-generation-progress.tsx apps/frontend/src/components/prd/
```

#### Step 3.3: Add Navigation Links
Update sidebar navigation to include:
- "PRD Generator" under "Tools" section
- Link to `/prd/generate`

#### Step 3.4: Create Agent Runs Dashboard
```bash
mkdir -p "C:\CCW-Online ERP\apps\frontend\src\pages\dashboard\agent-runs"
cp marketing-addon/apps/web/app/dashboard/agent-runs/page.tsx apps/frontend/src/pages/dashboard/agent-runs/index.tsx
```

---

### Phase 4: Workflows Integration (Week 2 - Optional)

#### Step 4.1: Copy Workflow Files
```bash
mkdir -p "C:\CCW-Online ERP\apps\backend\src\workflows"
cp marketing-addon/apps/backend/src/workflows/*.py apps/backend/src/workflows/
```

**Note:** Most workflow functions are placeholders and would need full implementation.

#### Step 4.2: Implement Scheduled Tasks
Add Celery tasks for continuous improvement:

```python
# In celery_app.py
@celery_app.task
def run_tech_debt_scan():
    """Run daily tech debt scan."""
    improvement = ContinuousImprovement()
    issues = await improvement.scan_for_tech_debt()
    # Store results in database
```

---

### Phase 5: Configuration Updates (Week 2)

#### Step 5.1: Update Dependencies

**Backend (pyproject.toml):**
```toml
# No new dependencies needed - marketing addon uses same libraries
```

**Frontend (package.json):**
```json
{
  "dependencies": {
    // No new dependencies - marketing addon uses same UI libraries
  }
}
```

#### Step 5.2: Environment Variables

**Add to `.env`:**
```bash
# PRD Generation
PRD_OUTPUT_DIR=/tmp/prds
PRD_MAX_GENERATION_TIME=300  # 5 minutes

# Telemetry
ENABLE_USAGE_TRACKING=true

# Continuous Improvement
ENABLE_CONTINUOUS_IMPROVEMENT=false  # Start disabled until implemented
```

---

### Phase 6: Testing (Week 3)

#### Test 6.1: PRD Generation E2E Test
1. Navigate to `/prd/generate`
2. Enter requirements: "Build a task management app with due dates and priorities"
3. Verify PRD generates successfully
4. Check database for `prds` record
5. View generated PRD at `/prd/{id}`
6. Verify all 6 documents created (prd.md, user_stories.md, tech_spec.md, test_plan.md, roadmap.md, feature_list.json)

#### Test 6.2: Usage Tracking Test
1. Generate a PRD (triggers AI API calls)
2. Query `api_usage` table
3. Verify records created with correct token counts and costs
4. Check cost calculation accuracy

#### Test 6.3: Agent Runs Dashboard Test
1. Navigate to `/dashboard/agent-runs`
2. Verify PRD generation appears in history
3. Check progress tracking works
4. Verify error handling for failed runs

---

## Risk Mitigation

### Risk 1: Import Path Conflicts
**Likelihood:** High
**Impact:** Medium

**Mitigation:**
- Carefully review all import statements
- Use find-and-replace to update paths systematically
- Test each module in isolation before integration

### Risk 2: Database Schema Conflicts
**Likelihood:** Low
**Impact:** High

**Mitigation:**
- Review existing CCW-ERP schema before adding tables
- Use Alembic migrations (reversible)
- Test migrations in development environment first

### Risk 3: Supabase Dependencies
**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**
- Marketing addon uses Supabase for state storage
- Replace with direct PostgreSQL queries using CCW-ERP's session management
- Remove `src.state.supabase` imports

### Risk 4: Agent Architecture Mismatch
**Likelihood:** Medium
**Impact:** Medium

**Mitigation:**
- Marketing addon uses different BaseAgent interface
- Adapt PRD agents to use CCW-ERP's agent base class
- May need adapter pattern if interfaces differ significantly

---

## Success Criteria

### Must Have (MVP)
- ✅ PRD generation works end-to-end
- ✅ All 6 PRD documents generated correctly
- ✅ PRD UI accessible from CCW-ERP sidebar
- ✅ Usage tracking records AI API costs
- ✅ No conflicts with existing CCW-ERP features

### Nice to Have
- ✅ Agent runs dashboard showing PRD generation history
- ✅ API cost analytics dashboard
- ✅ Continuous improvement workflows (with full implementation)

### Won't Have (Out of Scope)
- ❌ Replacing CCW-ERP's existing agents
- ❌ Migrating to Supabase
- ❌ Changing authentication system

---

## Timeline

**Total Duration:** 3 weeks

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | Backend foundation | PRD agents, API endpoints, database migrations |
| 2 | Frontend integration | PRD UI pages, agent runs dashboard, navigation updates |
| 3 | Testing & refinement | E2E tests, bug fixes, documentation |

---

## Next Steps

1. **Review and approve this plan**
2. **Create feature branch:** `feature/prd-generation-integration`
3. **Start with Phase 1, Step 1.1:** Copy PRD agent files
4. **Test incrementally:** Don't wait until end to test
5. **Document as you go:** Update API docs, user guides

---

## File Mapping Reference

### Backend Files to Copy

| Source (marketing-addon) | Destination (CCW-ERP) | Status |
|-------------------------|----------------------|--------|
| `apps/backend/src/agents/prd/*.py` | `apps/backend/src/agents/prd/` | Pending |
| `apps/backend/src/telemetry/*.py` | `apps/backend/src/telemetry/` | Pending |
| `apps/backend/src/workflows/*.py` | `apps/backend/src/workflows/` | Optional |

### Frontend Files to Copy

| Source (marketing-addon) | Destination (CCW-ERP) | Status |
|-------------------------|----------------------|--------|
| `apps/web/app/prd/generate/page.tsx` | `apps/frontend/src/pages/prd/generate.tsx` | Pending |
| `apps/web/app/prd/[id]/page.tsx` | `apps/frontend/src/pages/prd/[id].tsx` | Pending |
| `apps/web/components/prd-generator-form.tsx` | `apps/frontend/src/components/prd/` | Pending |
| `apps/web/components/prd-generation-progress.tsx` | `apps/frontend/src/components/prd/` | Pending |
| `apps/web/app/dashboard/agent-runs/page.tsx` | `apps/frontend/src/pages/dashboard/agent-runs/` | Pending |

### Database Migrations to Create

1. `XXX_add_prd_tables.py` - PRD storage tables
2. `XXX_add_api_usage_table.py` - Usage tracking
3. `XXX_add_agent_runs_table.py` - Agent execution history

---

## Dependency Analysis

### Backend Dependencies (Already in CCW-ERP)
- ✅ FastAPI
- ✅ LangChain / LangGraph
- ✅ Pydantic
- ✅ SQLAlchemy
- ✅ Anthropic SDK

### Frontend Dependencies (Already in CCW-ERP)
- ✅ Next.js 15
- ✅ React 19
- ✅ Tailwind CSS v4
- ✅ shadcn/ui components

### No New Dependencies Required! 🎉

---

_End of Integration Plan_
