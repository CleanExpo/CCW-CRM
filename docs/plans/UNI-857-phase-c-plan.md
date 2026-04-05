# UNI-857 Implementation Plan: Phase C AI Features

## Context (what already exists)

### BaseAgent Pattern (apps/backend/src/ai/base_agent.py)

- Abstract class with `execute(task, context)` and `stream(task, context)` abstract methods
- `get_db_session()` async context manager for DB access
- `_log_execution_start()` / `_log_execution_complete()` logging helpers
- `auto_register=True` constructor param that registers agent with the AgentRegistry
- Subclasses set `self.capabilities`, `self.description`, `self.requires_verification`, `self.estimated_execution_time` in `__init__` BEFORE calling `super().__init__()`

### Existing Specialized Agents

Located in `apps/backend/src/ai/agents/specialized/`:

- `cin7_anomaly_agent.py` — canonical reference (pure functions + agent class pattern)
- `cin7_forecasting_agent.py`, `inventory_forecasting_agent.py`
- `pricing_agent.py`, `procurement_agent.py`, `task_executor_agent.py`
- `recommendation_agent.py`, `document_parser_agent.py`
- `project_intelligence_agent.py` — recently added

### Existing AI Routes

Located in `apps/backend/src/api/routes/ai/`:

- `generate.py` — already has `/api/ai/generate/image`, `/api/ai/generate/copy`, `/api/ai/generate/quote`, `/api/ai/generate/email`
- `chat.py` — full chat/stream/history pattern using singleton agent
- `cin7_forecast.py`, `cin7_anomaly.py` — per-agent route pattern

### Key Discovery: Product Copy Is Partially Implemented

- `apps/web/components/ai/AIProductCopyGenerator.tsx` — frontend dialog ALREADY EXISTS, calls `POST /api/ai/generate/product-copy`
- `apps/web/app/(dashboard)/products/components/ProductForm.tsx` — ALREADY imports and renders `AIProductCopyGenerator` with a "Generate with AI" button
- `apps/backend/src/api/routes/ai/generate.py` does NOT yet have a `/product-copy` endpoint (the frontend will get a 404)

### Key Discovery: Marketing Page Has UI but No AI Actions Wired

- `apps/web/app/(dashboard)/marketing/page.tsx` renders `MediaGenerator` and `AssetLibrary` components, has "Quick Actions" cards (static)
- `apps/web/lib/api/marketing.ts` only has `getStats()` → `GET /api/ai/stats`
- No backend routes for `generate-campaign`, `generate-email`, `generate-social`
- The "Quick Actions" cards in the marketing page are static click targets with no handlers

### Key Discovery: Staff Copilot Does Not Exist

- No `/copilot` page under `apps/web/app/(dashboard)/`
- No `staff_copilot_agent.py` in specialized agents
- `apps/web/components/ai/QuoteCopilotChat.tsx` is a quote-specific copilot (good reference component for building a general staff copilot widget)

### Environment Variables

Both `ANTHROPIC_API_KEY` (claude-opus-4-6) and `OPENAI_API_KEY` are documented in `.env.example`.
Demo mode will use hardcoded responses when neither key is present.

### How AI Routes Are Registered in main.py

Routes are imported conditionally inside a `try/except ImportError` block:

```python
try:
    from .routes.ai import ai_router, chat, generate, insights, inventory_forecast as ai_inventory_forecast
    _ai_routes_available = True
except ImportError:
    ...
```

New AI routes should be added to this same `try` block pattern, or registered via `try/except ImportError` at the router-include step (see warehouse, workshop patterns lower in main.py).

---

## Track 1: Marketing Agent

### Objective

Wire the existing static "Quick Actions" cards on the marketing page to real AI-powered generation endpoints. Add a `MarketingAgent` backend class and 3 new endpoints.

### SUB-1.1: MarketingAgent Backend Class (M)

**File to create**: `apps/backend/src/ai/agents/specialized/marketing_agent.py`

**What it does**: Inherits `BaseAgent`. Generates marketing campaign briefs, email copy, and social post copy. Demo mode returns realistic hardcoded responses when no LLM key is present.

**Class structure**:

```python
class MarketingAgent(BaseAgent):
    def __init__(self) -> None:
        self.capabilities = ["marketing_content", "campaign_generation", "email_copy", "social_copy"]
        self.description = "Generates marketing content: campaigns, emails, social posts"
        self.requires_verification = False
        self.estimated_execution_time = 5
        super().__init__(name="MarketingAgent", auto_register=True)

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        ...

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        yield "Marketing generation does not support streaming"
```

**Pure helper functions** (testable without DB or LLM):

```python
def build_campaign_prompt(product_name: str, target_audience: str, campaign_type: str) -> str: ...
def build_email_prompt(subject: str, tone: str, product_context: str) -> str: ...
def build_social_prompt(platform: str, product_name: str, key_message: str) -> str: ...
def get_demo_campaign_response(campaign_type: str) -> dict[str, Any]: ...
def get_demo_email_response(tone: str) -> dict[str, Any]: ...
def get_demo_social_response(platform: str) -> dict[str, Any]: ...
```

**`execute()` routing**:

- Reads `context["generation_type"]` — one of `"campaign"`, `"email"`, `"social"`
- In demo mode (no ANTHROPIC*API_KEY): calls the relevant `get_demo*\*\_response()` function
- In live mode: calls Anthropic API via `anthropic.AsyncAnthropic` with the built prompt

**Demo responses** (hardcoded, realistic for CCW cleaning equipment business):

- Campaign: `{ "headline": "...", "subheadline": "...", "cta": "...", "body": "...", "channel_suggestions": [...] }`
- Email: `{ "subject": "...", "preview_text": "...", "body": "...", "cta_text": "...", "cta_url": "#" }`
- Social: `{ "platform": "...", "post_text": "...", "hashtags": [...], "image_suggestion": "..." }`

**Acceptance criteria**:

- [ ] Agent instantiates without error (auto-registers with AgentRegistry)
- [ ] `execute()` with `generation_type="campaign"` returns campaign dict
- [ ] `execute()` with `generation_type="email"` returns email dict
- [ ] `execute()` with `generation_type="social"` returns social dict
- [ ] Demo mode works without any API keys
- [ ] Pure helper functions are importable and return correct structure

---

### SUB-1.2: Marketing AI Backend Routes (M)

**File to create**: `apps/backend/src/api/routes/ai/marketing.py`

**Router prefix**: `/api/ai/marketing`

**Endpoints**:

```python
router = APIRouter(prefix="/api/ai/marketing", tags=["AI Marketing"])

# --- Pydantic Models ---

class GenerateCampaignRequest(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=200)
    target_audience: str = Field(default="cleaning professionals")
    campaign_type: str = Field(default="product_launch")  # product_launch, promotion, seasonal, general
    key_message: str | None = Field(None, max_length=500)

class GenerateCampaignResponse(BaseModel):
    headline: str
    subheadline: str
    body: str
    cta: str
    channel_suggestions: list[str]
    generated_at: str
    demo_mode: bool

class GenerateEmailRequest(BaseModel):
    subject_hint: str = Field(..., min_length=1, max_length=200)
    tone: str = Field(default="professional")  # professional, friendly, urgent
    product_context: str | None = Field(None, max_length=500)

class GenerateEmailResponse(BaseModel):
    subject: str
    preview_text: str
    body: str
    cta_text: str
    generated_at: str
    demo_mode: bool

class GenerateSocialRequest(BaseModel):
    platform: str = Field(default="linkedin")  # linkedin, instagram, facebook
    product_name: str = Field(..., min_length=1, max_length=200)
    key_message: str | None = Field(None, max_length=300)

class GenerateSocialResponse(BaseModel):
    platform: str
    post_text: str
    hashtags: list[str]
    image_suggestion: str
    generated_at: str
    demo_mode: bool

# --- Endpoints ---
POST /generate-campaign -> GenerateCampaignResponse
POST /generate-email    -> GenerateEmailResponse
POST /generate-social   -> GenerateSocialResponse
```

**Singleton pattern** (matching `chat.py`):

```python
_marketing_agent: MarketingAgent | None = None

def get_marketing_agent() -> MarketingAgent:
    global _marketing_agent
    if _marketing_agent is None:
        _marketing_agent = MarketingAgent()
    return _marketing_agent
```

**Registration in main.py** — add inside the existing AI `try/except ImportError` block:

```python
from .routes.ai import ai_router, chat, generate, insights, inventory_forecast as ai_inventory_forecast, marketing as ai_marketing
```

Then include the router:

```python
app.include_router(ai_marketing.router)
```

**Acceptance criteria**:

- [ ] `POST /api/ai/marketing/generate-campaign` returns 200 with `GenerateCampaignResponse`
- [ ] `POST /api/ai/marketing/generate-email` returns 200 with `GenerateEmailResponse`
- [ ] `POST /api/ai/marketing/generate-social` returns 200 with `GenerateSocialResponse`
- [ ] All endpoints return `demo_mode: true` when no LLM key is configured
- [ ] All endpoints have proper Pydantic validation (422 on bad input)

---

### SUB-1.3: Update marketingApi Frontend Client (S)

**File to modify**: `apps/web/lib/api/marketing.ts`

**Add to the existing `marketingApi` object**:

```typescript
export interface GenerateCampaignRequest {
  product_name: string;
  target_audience?: string;
  campaign_type?: 'product_launch' | 'promotion' | 'seasonal' | 'general';
  key_message?: string;
}
export interface GenerateCampaignResponse {
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
  channel_suggestions: string[];
  generated_at: string;
  demo_mode: boolean;
}
export interface GenerateEmailRequest { subject_hint: string; tone?: string; product_context?: string; }
export interface GenerateEmailResponse { subject: string; preview_text: string; body: string; cta_text: string; generated_at: string; demo_mode: boolean; }
export interface GenerateSocialRequest { platform?: string; product_name: string; key_message?: string; }
export interface GenerateSocialResponse { platform: string; post_text: string; hashtags: string[]; image_suggestion: string; generated_at: string; demo_mode: boolean; }

// Add to marketingApi:
generateCampaign: (data: GenerateCampaignRequest): Promise<GenerateCampaignResponse> =>
  apiClient.post('/api/ai/marketing/generate-campaign', data),
generateEmail: (data: GenerateEmailRequest): Promise<GenerateEmailResponse> =>
  apiClient.post('/api/ai/marketing/generate-email', data),
generateSocial: (data: GenerateSocialRequest): Promise<GenerateSocialResponse> =>
  apiClient.post('/api/ai/marketing/generate-social', data),
```

Also export the new types from `apps/web/lib/api/index.ts`.

**Acceptance criteria**:

- [ ] All 3 methods typed and exported
- [ ] `pnpm run type-check` passes

---

### SUB-1.4: Wire Quick Actions on Marketing Page (M)

**File to modify**: `apps/web/app/(dashboard)/marketing/page.tsx`

**What to add**:

1. A `MarketingGenerateDialog` component (can be inline or extracted to `components/ai/MarketingGenerateDialog.tsx`)
2. Each "Quick Actions" card becomes clickable and opens the dialog pre-configured for its type
3. Dialog shows a form with relevant inputs (product name, tone, platform) → "Generate" button → shows result → copy-to-clipboard button

**State additions to marketing/page.tsx**:

```typescript
const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
const [generateType, setGenerateType] = useState<'campaign' | 'email' | 'social' | 'ad_copy'>(
  'campaign'
);
const [isGenerating, setIsGenerating] = useState(false);
const [generatedResult, setGeneratedResult] = useState<string | null>(null);
```

**Quick Action card mapping** (onClick handlers):

- "Product Launch Campaign" → `setGenerateType('campaign'); setGenerateDialogOpen(true)`
- "Social Media Bundle" → `setGenerateType('social'); setGenerateDialogOpen(true)`
- "Email Newsletter" → `setGenerateType('email'); setGenerateDialogOpen(true)`
- "Ad Campaign Assets" → `setGenerateType('campaign'); setGenerateDialogOpen(true)` (with `campaign_type: 'promotion'`)

**MarketingGenerateDialog**: Dialog with context-appropriate form fields, loading state, and copy-to-clipboard on result. Uses `marketingApi.generateCampaign/Email/Social()`. Follows the pattern in `QuoteCopilotChat.tsx` for UX.

**After successful generation**: increment `stats.copyGenerated` locally and toast "Content generated!"

**Acceptance criteria**:

- [ ] All 4 Quick Action cards are clickable
- [ ] Clicking opens a dialog with correct form fields for the content type
- [ ] Submitting the form calls the correct API endpoint
- [ ] Loading spinner shown during generation
- [ ] Generated content displayed with copy-to-clipboard button
- [ ] Toast on success and error
- [ ] TypeScript clean

---

## Track 2: AI Product Copy

### Objective

The frontend component (`AIProductCopyGenerator.tsx`) and the `ProductForm.tsx` integration already exist. The only missing piece is the backend endpoint `POST /api/ai/generate/product-copy` and a `ProductCopyAgent`.

### SUB-2.1: ProductCopyAgent Backend Class (M)

**File to create**: `apps/backend/src/ai/agents/specialized/product_copy_agent.py`

**Class structure**:

```python
class ProductCopyAgent(BaseAgent):
    def __init__(self) -> None:
        self.capabilities = ["product_copy", "product_description", "seo_copy", "feature_list"]
        self.description = "Generates compelling product copy, descriptions, and SEO titles"
        self.requires_verification = False
        self.estimated_execution_time = 4
        super().__init__(name="ProductCopyAgent", auto_register=True)

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        ...

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        yield "Product copy generation does not support streaming"
```

**Key context fields** read from `context`:

- `product_name: str`
- `product_category: str` (from ProductCategory enum: heavy_machinery, hand_tools, power_tools, etc.)
- `copy_type: str` — one of `"description"`, `"features"`, `"marketing"`, `"technical"`
- `key_info: str` — user-provided notes/specs

**Pure helper functions**:

```python
def build_product_copy_prompt(
    product_name: str,
    product_category: str,
    copy_type: str,
    key_info: str,
) -> str: ...

def get_demo_product_copy(
    product_name: str,
    product_category: str,
    copy_type: str,
) -> str: ...
```

**Demo responses per copy_type** (returns realistic cleaning equipment copy):

- `"description"`: 2-3 sentence product overview emphasising professional grade, durability
- `"features"`: bullet list of 5-6 key features appropriate to the category
- `"marketing"`: punchy sales pitch 1-2 sentences
- `"technical"`: specs format, e.g. "Power: 1800W | Pressure: 2800 PSI | Weight: 6.2kg"

**`execute()` returns**:

```python
return {
    "generated_copy": "...",
    "copy_type": copy_type,
    "product_name": product_name,
    "demo_mode": True/False,
}
```

**Acceptance criteria**:

- [ ] Agent instantiates without error
- [ ] All 4 copy types return populated `generated_copy` string
- [ ] Demo mode works without LLM keys
- [ ] `generated_copy` is non-empty for all categories × copy_type combinations

---

### SUB-2.2: Add `/product-copy` Endpoint to generate.py (S)

**File to modify**: `apps/backend/src/api/routes/ai/generate.py`

The `AIProductCopyGenerator.tsx` frontend already calls `POST /api/ai/generate/product-copy`. This endpoint must be added to the existing `generate.py` router (prefix already `/api/ai/generate`).

**Add these models and endpoint**:

```python
class ProductCopyRequest(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=255)
    product_category: str = Field(default="general")
    copy_type: str = Field(default="description")  # description | features | marketing | technical
    key_info: str = Field(default="", max_length=1000)

class ProductCopyResponse(BaseModel):
    generated_copy: str
    copy_type: str
    product_name: str
    demo_mode: bool

@router.post("/product-copy", response_model=ProductCopyResponse)
async def generate_product_copy(
    request: ProductCopyRequest,
    agent: Annotated[ProductCopyAgent, Depends(get_product_copy_agent)],
) -> ProductCopyResponse:
    ...
```

**Singleton getter**:

```python
_product_copy_agent: ProductCopyAgent | None = None

def get_product_copy_agent() -> ProductCopyAgent:
    global _product_copy_agent
    if _product_copy_agent is None:
        from src.ai.agents.specialized.product_copy_agent import ProductCopyAgent
        _product_copy_agent = ProductCopyAgent()
    return _product_copy_agent
```

No changes to `main.py` route registration needed — `generate.py` is already included in the AI routes block.

**Acceptance criteria**:

- [ ] `POST /api/ai/generate/product-copy` returns 200 with `{ "generated_copy": "...", ... }`
- [ ] Returns `demo_mode: true` when no LLM key is present
- [ ] Frontend `AIProductCopyGenerator.tsx` receives `response.generated_copy` and displays it
- [ ] 422 returned for missing `product_name`

---

### SUB-2.3: Verify Frontend Integration (S)

No new frontend code needed. Both `AIProductCopyGenerator.tsx` and its integration in `ProductForm.tsx` already exist. This sub-task is validation only:

1. Confirm the component calls `POST /api/ai/generate/product-copy` (line 91 of `AIProductCopyGenerator.tsx`) — confirmed
2. Confirm `ProductForm.tsx` passes `productName` and `productCategory` props to the component — confirmed
3. Confirm `handleCopyGenerated` in `ProductForm.tsx` inserts result into the description field — confirmed
4. Run `pnpm run type-check` to confirm no TypeScript errors

**What to check manually after backend is wired**:

- [ ] Open Product Form (create mode), type a product name
- [ ] Click "Generate with AI" button next to Description field
- [ ] Select "Product Description" copy type, add key info, click Generate
- [ ] Generated text appears in the dialog
- [ ] Click "Use This Copy" → description field is populated

---

## Track 3: Staff Copilot

### Objective

Build a persistent floating chat widget that staff can open from any dashboard page to ask operational questions. The copilot has context about the current module (orders, products, inventory) and can summarise records and suggest next actions.

### SUB-3.1: StaffCopilotAgent Backend Class (L)

**File to create**: `apps/backend/src/ai/agents/specialized/staff_copilot_agent.py`

**Class structure**:

```python
class StaffCopilotAgent(BaseAgent):
    def __init__(self) -> None:
        self.capabilities = ["staff_query", "order_summary", "next_action_suggestion", "erp_assistant"]
        self.description = "Answers staff queries about orders, inventory, customers, and operations"
        self.requires_verification = False
        self.estimated_execution_time = 6
        super().__init__(name="StaffCopilotAgent", auto_register=True)
```

**Context keys** read by `execute()`:

- `query_type: str` — `"general_query"` | `"summarise_order"` | `"summarise_customer"` | `"suggest_next_action"`
- `user_query: str` — the staff member's natural language question
- `module_context: str` — current page: `"orders"` | `"products"` | `"customers"` | `"inventory"` | `"general"`
- `entity_id: str | None` — order/customer/product ID if on a detail view
- `conversation_history: list[dict]` — prior messages in the session

**Key methods** (pure functions, testable):

```python
def build_system_prompt(module_context: str) -> str: ...
def format_conversation_history(history: list[dict]) -> list[dict]: ...
def get_demo_response(query_type: str, user_query: str, module_context: str) -> str: ...
def suggest_next_actions(module_context: str, entity_id: str | None) -> list[str]: ...
```

**DB access in `execute()`**:

- `query_type == "summarise_order"`: queries `orders` + `order_items` tables using `entity_id`
- `query_type == "summarise_customer"`: queries `customers` table
- `query_type == "suggest_next_action"`: queries recent orders/quotes for context
- `query_type == "general_query"`: no DB query, pure LLM response

**Execute return shape**:

```python
return {
    "answer": "...",
    "suggested_actions": [...],  # list of quick action strings
    "sources": [...],            # e.g. ["Order ORD-2026-042", "3 line items"]
    "demo_mode": True/False,
}
```

**Demo responses** (realistic for CCW operations):

```python
DEMO_RESPONSES = {
    "general_query": "I can help you with orders, inventory, customers, and product information. What would you like to know?",
    "summarise_order": "Order ORD-2026-042 is for Acme Services Pty Ltd — 3 items, total $4,850 AUD, status: Processing. Items: 2x Kärcher HD 5/15 C, 1x 30m hose reel.",
    "summarise_customer": "Pacific Cleaning Co has 12 orders this year, average order value $3,200. Last order was 5 days ago. Payment terms: Net 30.",
    "suggest_next_action": "Based on current context, suggested actions: 1) Follow up on 3 pending quotes expiring this week, 2) Reorder truckmount filters (stock at 2, minimum 5), 3) Send invoice for delivered order ORD-2026-039.",
}
```

**Acceptance criteria**:

- [ ] Agent instantiates without error
- [ ] `execute()` with `query_type="general_query"` returns `{"answer": "...", "suggested_actions": [...], ...}`
- [ ] `execute()` with `query_type="summarise_order"` queries DB and returns order summary
- [ ] Demo mode returns sensible default response for all query types
- [ ] `stream()` method yields chunks for streaming support (future enhancement, yields single complete response for now)

---

### SUB-3.2: Staff Copilot Backend Routes (M)

**File to create**: `apps/backend/src/api/routes/ai/staff_copilot.py`

**Router prefix**: `/api/ai/copilot`

**Endpoints**:

```python
router = APIRouter(prefix="/api/ai/copilot", tags=["Staff Copilot"])

class CopilotQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    query_type: str = Field(default="general_query")  # general_query | summarise_order | summarise_customer | suggest_next_action
    module_context: str = Field(default="general")    # orders | products | customers | inventory | general
    entity_id: str | None = Field(None)
    conversation_history: list[dict[str, str]] = Field(default_factory=list)

class CopilotQueryResponse(BaseModel):
    answer: str
    suggested_actions: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    demo_mode: bool
    query_type: str

class CopilotHealthResponse(BaseModel):
    status: str
    agent_id: str
    capabilities: list[str]

POST /query  -> CopilotQueryResponse   # Main query endpoint
GET  /health -> CopilotHealthResponse  # Health/status check
```

**Singleton pattern** matching `chat.py`:

```python
_staff_copilot: StaffCopilotAgent | None = None

def get_staff_copilot() -> StaffCopilotAgent:
    global _staff_copilot
    if _staff_copilot is None:
        _staff_copilot = StaffCopilotAgent()
    return _staff_copilot
```

**Registration in main.py** — add to the AI `try/except ImportError` block (same block as `chat`, `generate`):

```python
from .routes.ai import ai_router, chat, generate, insights, inventory_forecast as ai_inventory_forecast, marketing as ai_marketing, staff_copilot as ai_copilot
```

Then:

```python
app.include_router(ai_copilot.router)
```

**Acceptance criteria**:

- [ ] `POST /api/ai/copilot/query` returns 200 with `CopilotQueryResponse`
- [ ] `GET /api/ai/copilot/health` returns 200
- [ ] `demo_mode: true` returned when no LLM key configured
- [ ] `conversation_history` passed through to agent for multi-turn context

---

### SUB-3.3: Staff Copilot Frontend API Client (S)

**File to create**: `apps/web/lib/api/copilot.ts`

```typescript
import { apiClient } from './client';

export interface CopilotQueryRequest {
  query: string;
  query_type?: 'general_query' | 'summarise_order' | 'summarise_customer' | 'suggest_next_action';
  module_context?: 'orders' | 'products' | 'customers' | 'inventory' | 'general';
  entity_id?: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface CopilotQueryResponse {
  answer: string;
  suggested_actions: string[];
  sources: string[];
  demo_mode: boolean;
  query_type: string;
}

export const copilotApi = {
  query: (data: CopilotQueryRequest): Promise<CopilotQueryResponse> =>
    apiClient.post('/api/ai/copilot/query', data),

  health: (): Promise<{ status: string; agent_id: string; capabilities: string[] }> =>
    apiClient.get('/api/ai/copilot/health'),
};
```

**Export from index.ts**:

```typescript
export { copilotApi } from './copilot';
export type { CopilotQueryRequest, CopilotQueryResponse } from './copilot';
```

**Acceptance criteria**:

- [ ] Typed, no `any` usage
- [ ] `pnpm run type-check` passes

---

### SUB-3.4: StaffCopilotWidget Frontend Component (L)

**File to create**: `apps/web/components/ai/StaffCopilotWidget.tsx`

**Design**: Floating button in bottom-right corner of the viewport (fixed position). Clicking opens a chat panel (slide-up or side drawer). Follows the existing pattern from `QuoteCopilotChat.tsx`.

**Component interface**:

```typescript
interface StaffCopilotWidgetProps {
  moduleContext?: 'orders' | 'products' | 'customers' | 'inventory' | 'general';
  entityId?: string; // order_id, customer_id, product_id if on a detail page
}
```

**Key UI elements**:

- Floating trigger button: `position: fixed; bottom: 24px; right: 24px; z-index: 50` — uses `Button` with `Sparkles` icon and "Copilot" label
- Chat panel: fixed 400px wide right-side panel or 480px Dialog — uses `ScrollArea` for messages
- Message input: `Input` with `Send` button, Enter-to-submit
- Quick action chips: shows `suggested_actions` from response as clickable Badge elements that auto-populate the input
- Loading state: animated "..." typing indicator while waiting
- Message bubbles: user (right-aligned, brand primary) and assistant (left-aligned, muted background)

**Local state**:

```typescript
const [isOpen, setIsOpen] = useState(false);
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [conversationHistory, setConversationHistory] = useState<
  Array<{ role: string; content: string }>
>([]);
```

**Message sending flow**:

1. Append user message to `messages` state immediately (optimistic)
2. Call `copilotApi.query({ query: input, module_context, entity_id, conversation_history })`
3. Append assistant response to `messages`
4. Update `conversationHistory` for multi-turn context
5. Show `suggested_actions` as clickable chips below the assistant message

**Integration point** — add to Dashboard layout:
**File to modify**: `apps/web/app/(dashboard)/layout.tsx`

Import and render `StaffCopilotWidget` at the bottom of the layout, outside the main content area:

```tsx
<StaffCopilotWidget moduleContext="general" />
```

This makes the copilot available on all dashboard pages.

**Acceptance criteria**:

- [ ] Floating button visible on all dashboard pages
- [ ] Clicking opens chat panel
- [ ] Can send a message and receive a response
- [ ] Conversation history maintained within the session (multi-turn)
- [ ] Suggested action chips appear and clicking them pre-fills the input
- [ ] Loading state shown between send and response
- [ ] TypeScript clean, no `any`
- [ ] Works in demo mode (no LLM key needed)

---

## Demo Mode Strategy

All 3 agents use the same pattern for demo mode:

```python
import os

def _is_demo_mode() -> bool:
    """Return True when no LLM API key is configured."""
    return not (
        os.getenv("ANTHROPIC_API_KEY") or
        os.getenv("OPENAI_API_KEY") or
        os.getenv("GOOGLE_AI_API_KEY")
    )
```

Each agent's `execute()` method checks `_is_demo_mode()` at the top:

- If demo mode: call the appropriate `get_demo_*_response()` pure function and return immediately
- If live mode: call Anthropic API (preferred, since `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL=claude-opus-4-6` are already configured)

Demo responses are:

- **Realistic** — tailored to CCW cleaning equipment business context
- **Complete** — match the exact response schema so frontend renders without modification
- **Immediate** — no artificial delay, just `return` the hardcoded dict
- **Flagged** — always include `demo_mode: true` so frontend can optionally display a "Demo Mode" badge

For the Staff Copilot specifically, demo mode returns the same multi-turn structure — later queries in the same session simply return slightly different hardcoded responses to simulate intelligence.

---

## Recommended Implementation Order

### Phase 1: Foundation (Day 1) — Unblock the already-wired Product Copy UI

1. **SUB-2.1** — Create `ProductCopyAgent` (30 min)
2. **SUB-2.2** — Add `/product-copy` endpoint to `generate.py` (20 min)
3. **SUB-2.3** — Verify frontend integration works end-to-end (15 min)

This is the highest ROI task: the entire frontend is already built. One endpoint wires it.

### Phase 2: Marketing Backend (Day 1-2)

4. **SUB-1.1** — Create `MarketingAgent` (45 min)
5. **SUB-1.2** — Create `marketing.py` routes (30 min)
6. **SUB-1.3** — Update `marketingApi` client (20 min)
7. **SUB-1.4** — Wire Quick Actions on marketing page (1 hour)

### Phase 3: Staff Copilot (Day 2-3)

8. **SUB-3.1** — Create `StaffCopilotAgent` (60 min)
9. **SUB-3.2** — Create `staff_copilot.py` routes (30 min)
10. **SUB-3.3** — Create `copilot.ts` API client (20 min)
11. **SUB-3.4** — Build `StaffCopilotWidget` and wire into layout (90 min)

### Total Estimate: ~8 hours of focused implementation

---

## Files Summary

### Files to Create

| Path                                                            | Purpose            |
| --------------------------------------------------------------- | ------------------ |
| `apps/backend/src/ai/agents/specialized/marketing_agent.py`     | Track 1 agent      |
| `apps/backend/src/api/routes/ai/marketing.py`                   | Track 1 routes     |
| `apps/backend/src/ai/agents/specialized/product_copy_agent.py`  | Track 2 agent      |
| `apps/backend/src/ai/agents/specialized/staff_copilot_agent.py` | Track 3 agent      |
| `apps/backend/src/api/routes/ai/staff_copilot.py`               | Track 3 routes     |
| `apps/web/lib/api/copilot.ts`                                   | Track 3 API client |
| `apps/web/components/ai/StaffCopilotWidget.tsx`                 | Track 3 UI widget  |

### Files to Modify

| Path                                          | Change                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/backend/src/api/routes/ai/generate.py`  | Add `ProductCopyRequest/Response` models + `/product-copy` endpoint       |
| `apps/backend/src/api/main.py`                | Register `ai_marketing` and `ai_copilot` routers in AI `try/except` block |
| `apps/web/lib/api/marketing.ts`               | Add `generateCampaign`, `generateEmail`, `generateSocial` methods         |
| `apps/web/lib/api/index.ts`                   | Export new marketing types + `copilotApi`                                 |
| `apps/web/app/(dashboard)/marketing/page.tsx` | Add `MarketingGenerateDialog` component, wire Quick Action cards          |
| `apps/web/app/(dashboard)/layout.tsx`         | Import and render `StaffCopilotWidget` at bottom of layout                |

### Files Already Done (no changes needed)

| Path                                                           | Status                                    |
| -------------------------------------------------------------- | ----------------------------------------- |
| `apps/web/components/ai/AIProductCopyGenerator.tsx`            | Complete — calls correct endpoint         |
| `apps/web/app/(dashboard)/products/components/ProductForm.tsx` | Complete — renders AIProductCopyGenerator |

---

## Risk Register

| Risk                                                                       | Impact | Mitigation                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic API unavailable / no key                                         | Medium | Demo mode is fully implemented for all 3 agents — all features work without LLM keys                                                                       |
| `generate.py` already has `/copy` endpoint (different signature)           | Low    | New endpoint is `/product-copy`, distinct path, no conflict                                                                                                |
| `StaffCopilotWidget` floating position conflicts with other fixed elements | Low    | Use `z-index: 50`, position `bottom-6 right-6`. Check for conflicts with toaster (`z-index: 50` by default in shadcn — may need `z-index: 60` for copilot) |
| Registering new routers breaks existing AI routes import                   | Low    | Use the same `try/except ImportError` pattern as existing code. New routers added to the same `try` block                                                  |
| `main.py` AI routes import line gets too long                              | Low    | Split into two imports or use `from .routes.ai import ...` per-route pattern                                                                               |
| Staff Copilot stores conversation in local state only (no persistence)     | Medium | Acceptable for MVP. Persistence can be added in a follow-up using the existing `ConversationHistory` DB model in `demo_models.py`                          |
| TypeScript strict mode flag — tsconfig.json UNI-1255 is backlog            | Low    | Write explicit types for all new interfaces; avoid `any`; plan already compliant with strict mode                                                          |

---

_Plan authored: 2026-03-03_
_Target branch: ai-updates_
_Linear issue: UNI-857_
