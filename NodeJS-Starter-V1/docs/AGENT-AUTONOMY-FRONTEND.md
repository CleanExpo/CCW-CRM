# Agent Autonomy Frontend Implementation

**Status:** ✅ Complete
**Date:** January 14, 2026
**Component:** Week 6 - Agent Performance Dashboard (Frontend UI)

---

## Overview

This document describes the frontend implementation of the Agent Autonomy Management system. The UI provides administrators with complete control over agent configurations, approval workflows, and performance monitoring.

**What This Enables:**
- Configure agent autonomy levels and thresholds
- Review and approve/reject pending agent decisions
- Monitor agent performance with comprehensive analytics
- View learning insights and apply AI-generated recommendations

---

## Architecture

### File Structure

```
apps/web/
├── lib/
│   ├── types/autonomy.ts              # TypeScript type definitions
│   └── api/autonomy.ts                # API client methods and utilities
├── app/(dashboard)/
│   ├── settings/autonomy/page.tsx     # Agent configuration page
│   ├── approvals/pending/page.tsx     # Pending approvals page
│   └── agents/performance/page.tsx    # Performance dashboard page
└── components/autonomy/
    ├── agent-config-list.tsx          # List of agents with configs
    ├── agent-config-dialog.tsx        # Configuration editor dialog
    ├── pending-decisions-list.tsx     # List of pending decisions
    ├── decision-review-dialog.tsx     # Decision review and approval
    └── agent-performance-dashboard.tsx # Performance analytics dashboard
```

---

## Components

### 1. Agent Configuration Page (`/settings/autonomy`)

**Purpose:** Configure agent autonomy levels, confidence thresholds, and rate limits.

**Features:**
- Grid view of all agents with current configurations
- Quick stats (decision count, auto-execution rate)
- Per-agent configuration editor
- Links to performance dashboard

**Key Components:**
- `AgentConfigList` - Displays all agents in a responsive grid
- `AgentConfigDialog` - Modal dialog for editing configuration

**Configuration Options:**
- Autonomy level (Advisory, Semi-Autonomous, Fully Autonomous)
- Confidence thresholds (low/medium/high risk)
- Auto-approval limits (amount, quantity)
- Rate limits (per hour, per day)
- Learning toggle
- Notification preferences

---

### 2. Pending Approvals Page (`/approvals/pending`)

**Purpose:** Review and approve/reject decisions that require human oversight.

**Features:**
- Filterable list of pending decisions
- Agent filter dropdown
- Real-time refresh
- Risk level badges
- Confidence scores
- Expiration warnings
- Empty state when no pending decisions

**Key Components:**
- `PendingDecisionsList` - Displays all pending decisions
- `DecisionReviewDialog` - Modal for reviewing and approving/rejecting

**Decision Information Shown:**
- Decision type and agent
- Risk level and confidence score
- Context and recommendation details
- Estimated financial impact
- Created/expires timestamps

**Approval Workflow:**
1. Click decision card to open review dialog
2. Review decision details, context, and recommendation
3. Approve (instant) or Reject (with reason)
4. Feedback used for learning

---

### 3. Agent Performance Dashboard (`/agents/performance`)

**Purpose:** Monitor agent performance and view learning insights.

**Features:**
- Agent selector dropdown
- Time period selector (24h, 7d, 30d)
- Overview stats cards
- Tabbed views (Learning Analysis, Recommendations)
- One-click application of recommendations

**Stats Displayed:**
- Total decisions
- Auto-execution rate
- Approval rate
- Success rate
- Risk breakdown
- Financial impact

**Learning Analysis Tab:**
- **Confidence Accuracy:** Success rates by confidence range (0.9-1.0, 0.8-0.9, etc.)
- **Risk Assessment Accuracy:** Success rates by risk level (low, medium, high)
- **Human Override Patterns:** Approval vs rejection counts and rates

**Recommendations Tab:**
- AI-generated threshold adjustments
- Recommendation confidence levels (high/medium/low)
- Current vs recommended values
- One-click apply button
- Based on analysis of historical data

---

## TypeScript Types

### Core Types

```typescript
// Autonomy levels
enum AutonomyLevel {
  ADVISORY = 'advisory',
  SEMI_AUTONOMOUS = 'semi_autonomous',
  FULLY_AUTONOMOUS = 'fully_autonomous',
}

// Decision statuses
enum DecisionStatus {
  PENDING = 'pending',
  AUTO_EXECUTED = 'auto_executed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

// Risk levels
enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
```

### Configuration

```typescript
interface AgentAutonomyConfig {
  agent_id: string;
  autonomy_level: AutonomyLevel;
  enabled: boolean;

  // Confidence thresholds (0.0 - 1.0)
  min_confidence_low_risk: number;
  min_confidence_medium_risk: number;
  min_confidence_high_risk: number;

  // Auto-approval limits
  max_auto_approval_amount: number;
  max_auto_approval_quantity: number;

  // Rate limits
  max_actions_per_hour: number;
  max_actions_per_day: number;

  // Learning and notifications
  learning_enabled: boolean;
  notify_on_execution: boolean;
  notify_on_pending: boolean;
}
```

### Decisions

```typescript
interface AgentDecision {
  decision_id: string;
  agent_id: string;
  decision_type: string;

  // Decision data
  recommendation: any;
  confidence: number;
  risk_level: RiskLevel;
  context?: any;

  // Status
  status: DecisionStatus;
  requires_approval: boolean;

  // Approval tracking
  approved_at?: string;
  approved_by?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string;

  // Execution tracking
  executed: boolean;
  executed_at?: string;

  // Outcome tracking
  outcome_success?: boolean;
  outcome_metrics?: any;
  outcome_feedback?: string;
  outcome_rating?: number; // 1-5
}
```

### Learning & Analysis

```typescript
interface LearningAnalysis {
  agent_id: string;
  analysis_period_days: number;
  total_decisions: number;
  decision_breakdown: DecisionBreakdown;
  confidence_analysis: Record<string, ConfidenceAccuracy>;
  risk_analysis: Record<string, RiskAccuracy>;
  human_override_patterns: HumanOverridePattern;
  execution_analysis: ExecutionAnalysis;
}

interface ThresholdRecommendation {
  type: 'confidence_threshold' | 'autonomy_level' | 'rate_limit';
  parameter: string;
  current_value: number | string;
  recommended_value: number | string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}
```

---

## API Client Methods

### Agent Configuration

```typescript
// List all agents
listAgents(): Promise<AgentListResponse>

// Get agent config
getAgentConfig(agentId: string): Promise<AgentAutonomyConfig>

// Update agent config
updateAgentConfig(
  agentId: string,
  updates: ConfigUpdateRequest,
  updatedBy?: string
): Promise<AgentAutonomyConfig>
```

### Decisions

```typescript
// Query decisions with filters
queryDecisions(filter: DecisionFilter): Promise<DecisionListResponse>

// Get pending decisions
getPendingDecisions(agentId?: string, limit?: number): Promise<AgentDecision[]>

// Approve decision
approveDecision(decisionId: string, approvedBy: string): Promise<AgentDecision>

// Reject decision
rejectDecision(
  decisionId: string,
  rejectedBy: string,
  reason: string
): Promise<AgentDecision>

// Record outcome
recordDecisionOutcome(
  decisionId: string,
  outcome: OutcomeRecordRequest
): Promise<AgentDecision>
```

### Performance & Learning

```typescript
// Get agent stats
getAgentStats(
  agentId: string,
  timePeriod: 'last_24h' | 'last_7d' | 'last_30d'
): Promise<AutonomyStats>

// Get learning analysis
getLearningAnalysis(agentId: string, days: number): Promise<LearningAnalysis>

// Get recommendations
getThresholdRecommendations(
  agentId: string,
  days: number
): Promise<ThresholdRecommendations>
```

### Utility Functions

```typescript
// Format confidence as percentage
formatConfidence(confidence: number): string

// Get risk level color class
getRiskColor(riskLevel: string): string

// Get risk badge variant
getRiskBadgeVariant(riskLevel: string): BadgeVariant

// Get status color class
getStatusColor(status: string): string

// Get status badge variant
getStatusBadgeVariant(status: string): BadgeVariant

// Format autonomy level for display
formatAutonomyLevel(level: string): string
```

---

## User Workflows

### Workflow 1: Configure Agent Autonomy

1. Navigate to **Settings → Autonomy** (`/settings/autonomy`)
2. View all agents with current configurations
3. Click **Configure** button on desired agent
4. Configure in tabbed dialog:
   - **General:** Enable/disable, autonomy level, learning toggle
   - **Thresholds:** Confidence sliders for low/medium/high risk
   - **Limits:** Max amounts, quantities, rate limits, notifications
5. Click **Save Changes**
6. Configuration immediately applied

**Use Cases:**
- Increase autonomy level after agent proves reliable
- Lower confidence thresholds to allow more auto-execution
- Set rate limits to prevent runaway automation
- Enable learning to allow continuous improvement

---

### Workflow 2: Review & Approve Pending Decisions

1. Navigate to **Approvals → Pending** (`/approvals/pending`)
2. Filter by agent (optional)
3. Review list of pending decisions
4. Click decision card to open review dialog
5. Review details:
   - Decision type and recommendation
   - Risk level and confidence score
   - Context and estimated impact
   - Created/expires timestamps
6. Choose action:
   - **Approve:** Decision executes immediately
   - **Reject:** Provide reason for rejection (used for learning)
7. Decision removed from pending list

**Expiration Handling:**
- Decisions have expiration times (configurable)
- Warning shown if expiring within 1 hour
- Expired decisions automatically marked as expired

---

### Workflow 3: Monitor Agent Performance

1. Navigate to **Agents → Performance** (`/agents/performance`)
2. Select agent from dropdown
3. Select time period (24h, 7d, 30d)
4. View overview stats:
   - Total decisions, auto-execution rate
   - Approval rate, success rate
5. Switch to **Learning Analysis** tab:
   - View confidence accuracy by range
   - View risk accuracy by level
   - View human override patterns
6. Switch to **Recommendations** tab:
   - Review AI-generated recommendations
   - Read reasoning and confidence level
   - Click **Apply Recommendation** to accept

**Insights Provided:**
- Are confidence scores accurate? (high confidence → high success?)
- Are risk levels accurate? (low risk → high success?)
- Are humans approving or rejecting most decisions?
- Should thresholds be adjusted?

---

## Design Patterns

### State Management

**Pattern:** React hooks with useState and useEffect

```typescript
const [agents, setAgents] = useState<AgentSummary[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  loadAgents();
}, []);
```

**Why:** Simple, no external state library needed for these views.

---

### Data Loading

**Pattern:** Parallel loading with Promise.all

```typescript
const [statsData, analysisData, recommendationsData] = await Promise.all([
  getAgentStats(agentId, timePeriod),
  getLearningAnalysis(agentId, days),
  getThresholdRecommendations(agentId, days),
]);
```

**Why:** Faster page loads by fetching independent data in parallel.

---

### Form Validation

**Pattern:** Zod schema with react-hook-form

```typescript
const formSchema = z.object({
  autonomy_level: z.nativeEnum(AutonomyLevel),
  min_confidence_low_risk: z.number().min(0).max(1),
  // ...
});

const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
});
```

**Why:** Type-safe validation with excellent DX.

---

### Error Handling

**Pattern:** Try-catch with toast notifications

```typescript
try {
  await updateAgentConfig(agentId, updates);
  toast({ title: 'Success', description: 'Config updated' });
} catch (error) {
  toast({
    title: 'Error',
    description: 'Failed to update config',
    variant: 'destructive'
  });
}
```

**Why:** User-friendly error messages without crashing the app.

---

## Styling & UX

### Design Tokens

Uses Tailwind CSS with shadcn/ui components:
- `text-muted-foreground` - Secondary text
- `bg-accent` - Hover states
- `border` - Border color
- `text-destructive` - Error states

### Responsive Design

- Grid layouts adapt: 4 cols → 2 cols → 1 col
- Cards stack on mobile
- Dialogs scroll vertically on small screens

### Loading States

- Skeleton loaders for initial load
- Inline spinners for actions
- Disabled buttons during submission

### Empty States

- Friendly messages when no data
- Icons and descriptions
- Call-to-action hints

---

## Testing

### Manual Testing Checklist

**Agent Configuration:**
- [ ] List all agents loads correctly
- [ ] Configuration dialog opens and loads current config
- [ ] All form fields validate properly
- [ ] Saving updates configuration
- [ ] Changes reflect immediately in list

**Pending Approvals:**
- [ ] Pending decisions list loads
- [ ] Agent filter works
- [ ] Refresh button reloads data
- [ ] Review dialog shows all decision details
- [ ] Approve action works
- [ ] Reject action requires reason and works
- [ ] Expiration warning shows when < 1 hour

**Performance Dashboard:**
- [ ] Agent selector works
- [ ] Time period selector works
- [ ] Stats cards display correct data
- [ ] Learning analysis tab shows all metrics
- [ ] Recommendations tab shows recommendations
- [ ] Apply recommendation button works
- [ ] Empty states show when no data

---

## Integration with Backend

### API Endpoints Used

All endpoints are under `/api/autonomy`:

**Configuration:**
- `GET /api/autonomy/agents` - List agents
- `GET /api/autonomy/config/{agent_id}` - Get config
- `PUT /api/autonomy/config/{agent_id}` - Update config

**Decisions:**
- `GET /api/autonomy/decisions` - Query decisions
- `GET /api/autonomy/decisions/pending` - Get pending
- `POST /api/autonomy/decisions/{decision_id}/approve` - Approve
- `POST /api/autonomy/decisions/{decision_id}/reject` - Reject
- `POST /api/autonomy/decisions/{decision_id}/outcome` - Record outcome

**Performance:**
- `GET /api/autonomy/stats/{agent_id}` - Get stats
- `GET /api/autonomy/learning/analysis/{agent_id}` - Get analysis
- `GET /api/autonomy/learning/recommendations/{agent_id}` - Get recommendations

### Authentication

All API calls go through `apiClient` which handles:
- JWT token from cookies
- Automatic token refresh
- Error handling

---

## Future Enhancements

### Short-term (Next Sprint)

1. **Real-time Updates**
   - WebSocket integration for live pending decisions
   - Auto-refresh when new decisions arrive
   - Live stats updates

2. **Bulk Operations**
   - Approve/reject multiple decisions at once
   - Bulk configuration updates

3. **Advanced Filtering**
   - Filter by date range
   - Filter by decision type
   - Filter by confidence range

### Medium-term

1. **Charts & Visualizations**
   - Line charts for trends over time
   - Bar charts for decision breakdown
   - Confidence vs success scatter plots

2. **Notifications**
   - Browser notifications for pending approvals
   - Email notifications (configurable)
   - Slack integration

3. **Role-Based Access**
   - Different users see different agents
   - Approval workflows with multi-level approval

### Long-term

1. **Mobile App**
   - Native mobile apps for on-the-go approvals
   - Push notifications

2. **Advanced Analytics**
   - ML-powered anomaly detection
   - Predictive analytics for decision outcomes
   - Cost/benefit analysis

---

## Files Created

### TypeScript Types & API
- `apps/web/lib/types/autonomy.ts` (320 lines)
- `apps/web/lib/api/autonomy.ts` (350 lines)

### Pages
- `apps/web/app/(dashboard)/settings/autonomy/page.tsx` (30 lines)
- `apps/web/app/(dashboard)/approvals/pending/page.tsx` (25 lines)
- `apps/web/app/(dashboard)/agents/performance/page.tsx` (25 lines)

### Components
- `apps/web/components/autonomy/agent-config-list.tsx` (160 lines)
- `apps/web/components/autonomy/agent-config-dialog.tsx` (380 lines)
- `apps/web/components/autonomy/pending-decisions-list.tsx` (200 lines)
- `apps/web/components/autonomy/decision-review-dialog.tsx` (230 lines)
- `apps/web/components/autonomy/agent-performance-dashboard.tsx` (450 lines)

**Total:** 9 files, ~2,170 lines of code

---

## Summary

The Agent Autonomy Frontend provides a complete UI for managing AI agent autonomy in the CCW-Online ERP system. It enables administrators to:

✅ Configure agent autonomy levels and safety thresholds
✅ Review and approve/reject decisions requiring human oversight
✅ Monitor agent performance with comprehensive analytics
✅ View learning insights and apply AI-generated improvements

**Week 6 is now 100% complete.**

**Next Steps:** Week 7 - Infrastructure Optimization (Docker, Kubernetes, Monitoring)

---

*Document Version: 1.0*
*Last Updated: January 14, 2026*
