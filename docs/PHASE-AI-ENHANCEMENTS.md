# Phase AI Enhancements - Implementation Plan

**Date:** February 3, 2026
**Phase:** 2.1 - AI-Powered Productivity Features
**Status:** Ready for Implementation
**Estimated Effort:** 72 hours (2 weeks with 2 developers)

---

## 🎯 Executive Summary

Building on the mature AI infrastructure (7.5/10 maturity, 9 existing agents), this phase adds 4 high-impact AI features that deliver measurable productivity gains:

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| **Smart Form Auto-Fill** | 16h | 40% faster order entry | P0 |
| **Anomaly Detection** | 12h | 30% error reduction | P0 |
| **Email/Document Parsing** | 20h | 60% faster processing | P1 |
| **Inventory Forecasting** | 24h | 25% fewer stockouts | P1 |

**Total ROI:** 4-6 weeks to break even on development time through efficiency gains.

---

## 📊 Current AI Infrastructure Assessment

### Existing Agents (9 Total)

**Core Agents:**
1. `ChatAssistant` - Conversational AI with streaming responses
2. `ContentGenerator` - Marketing copy, emails, quotes generation
3. `InsightsAgent` - Business intelligence and analytics

**Specialized Agents:**
4. `PricingAgent` - Dynamic pricing recommendations
5. `ProcurementAgent` - Inventory analysis and reorder suggestions
6. `TaskExecutorAgent` - Automated action execution with confirmation
7. `SearchAgent` - Semantic/hybrid product search (pgvector)
8. `RecommendationAgent` - Collaborative filtering + content-based recommendations
9. `DevelopmentAgent` - Code generation and testing automation

### Existing Infrastructure

**Backend:**
- `BaseAgent` class with health checks, metrics, registry
- `OllamaClient` for LLM integration (Llama 3.2, Qwen)
- Agent orchestration with LangGraph
- Learning engine with pattern detection and A/B testing
- Monitoring with health reports and execution metrics

**API Endpoints:**
- `/api/ai/chat` - Chat conversations
- `/api/ai/generate` - Content generation
- `/api/ai/insights` - Business insights
- `/api/search/semantic` - Vector search
- `/api/recommendations/similar` - Product recommendations
- `/specialized/pricing` - Pricing optimization
- `/specialized/procurement` - Inventory analysis
- `/specialized/executor` - Action automation

**What's Missing:**
- Form auto-fill intelligence (manual entry required)
- Proactive anomaly detection (reactive issue resolution)
- Document parsing automation (manual data entry from emails/PDFs)
- Inventory forecasting (only current stock analysis)

---

## 🚀 Feature 1: Smart Form Auto-Fill (P0)

**Goal:** Context-aware form population to eliminate repetitive data entry.

### Use Cases

1. **New Order for Existing Customer:**
   - Pre-fills: Last shipping address, payment method, common products
   - Suggests: Products from last 3 orders, quantities based on history
   - Saves: 2-3 minutes per order, 40% faster entry

2. **New Quote for Repeat Customer:**
   - Pre-fills: Customer details, payment terms, delivery preferences
   - Suggests: Products frequently quoted together
   - Saves: 1-2 minutes per quote

3. **Purchase Order Creation:**
   - Pre-fills: Supplier standard quantities, delivery terms
   - Suggests: Reorder quantities based on sales velocity
   - Saves: 2 minutes per PO

4. **Customer Entry with Deduplication:**
   - Detects: Existing customers by email/name/phone
   - Warns: "Similar customer exists: [Name] - [Email]"
   - Prevents: Duplicate customer records

### Implementation Plan

#### Backend Components

**1. New Agent: `FormAutoFillAgent`**
- **File:** `apps/backend/src/ai/agents/specialized/form_autofill_agent.py`
- **Extends:** `BaseAgent`
- **Capabilities:** `["form_autofill", "customer_history", "pattern_detection"]`

```python
class FormAutoFillAgent(BaseAgent):
    """
    Provides context-aware form auto-fill suggestions.

    Analyzes customer history, order patterns, and common workflows
    to pre-populate form fields and reduce manual data entry.
    """

    async def execute(self, task: str, context: dict[str, Any]) -> dict[str, Any]:
        """
        Generate auto-fill suggestions based on context.

        Context keys:
        - form_type: "order", "quote", "purchase_order", "customer"
        - customer_id: UUID of customer (if applicable)
        - supplier_id: UUID of supplier (for POs)
        - limit: Number of suggestions (default: 5)

        Returns:
        - suggestions: Dict of field names → suggested values
        - confidence: Float 0-1 for each suggestion
        - source: Where suggestion came from (last_order, pattern, etc.)
        """
        pass

    async def get_customer_order_history(
        self,
        customer_id: UUID,
        limit: int = 3
    ) -> list[dict]:
        """Fetch last N orders for customer."""
        pass

    async def detect_duplicate_customer(
        self,
        email: str,
        name: str,
        phone: str | None = None
    ) -> list[dict]:
        """Detect potential duplicate customers."""
        pass

    async def suggest_products_for_customer(
        self,
        customer_id: UUID,
        limit: int = 10
    ) -> list[dict]:
        """Suggest products based on purchase history."""
        pass
```

**2. API Endpoint: `/api/ai/form-autofill`**
- **File:** `apps/backend/src/api/routes/ai/form_autofill.py`

```python
@router.post("/form-autofill")
async def auto_fill_form(
    request: AutoFillRequest,
    db: AsyncSession = Depends(get_db)
) -> AutoFillResponse:
    """
    Get form auto-fill suggestions.

    Body:
    {
      "form_type": "order",
      "customer_id": "uuid",
      "context": {}
    }

    Returns:
    {
      "suggestions": {
        "shipping_address": {...},
        "products": [{...}],
        "payment_method": "credit_card"
      },
      "confidence": {
        "shipping_address": 0.95,
        "products": 0.82,
        "payment_method": 0.90
      },
      "source": {
        "shipping_address": "last_order",
        "products": "pattern_3_orders",
        "payment_method": "customer_default"
      }
    }
    """
    pass
```

**3. Database Queries Needed:**
- Last N orders for customer (sorted by date)
- Products ordered by customer (with frequency)
- Customer default settings (shipping, payment)
- Duplicate detection (fuzzy match on name/email)

#### Frontend Integration

**1. React Hook: `useFormAutoFill`**
- **File:** `apps/web/lib/hooks/use-form-autofill.ts`

```typescript
export function useFormAutoFill<T>(
  formType: "order" | "quote" | "purchase_order" | "customer",
  customerId?: string,
  supplierId?: string
) {
  const [suggestions, setSuggestions] = useState<T | null>(null);
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.post("/api/ai/form-autofill", {
        form_type: formType,
        customer_id: customerId,
        supplier_id: supplierId,
      });
      setSuggestions(response.suggestions);
      setConfidence(response.confidence);
    } finally {
      setLoading(false);
    }
  }, [formType, customerId, supplierId]);

  return { suggestions, confidence, loading, fetchSuggestions };
}
```

**2. UI Component: Auto-Fill Badge**
- **File:** `apps/web/components/forms/AutoFillSuggestion.tsx`

```tsx
interface AutoFillSuggestionProps {
  fieldName: string;
  suggestion: any;
  confidence: number;
  onApply: () => void;
}

export function AutoFillSuggestion({
  fieldName,
  suggestion,
  confidence,
  onApply
}: AutoFillSuggestionProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
      <Sparkles className="h-4 w-4 text-blue-600" />
      <span className="text-sm text-blue-900">
        AI suggests: {JSON.stringify(suggestion)}
      </span>
      <Badge variant="outline">{(confidence * 100).toFixed(0)}% confident</Badge>
      <Button size="sm" onClick={onApply}>Apply</Button>
    </div>
  );
}
```

**3. Integration in Forms:**
- `OrderForm.tsx` - Show suggestions when customer selected
- `QuoteForm.tsx` - Pre-fill customer data and products
- `PurchaseOrderForm.tsx` - Suggest quantities for supplier
- `CustomerForm.tsx` - Warn about duplicates

### Success Metrics

- [ ] Order entry time reduced from 5min → 3min (40% faster)
- [ ] 80%+ of suggestions accepted by users
- [ ] Duplicate customer creation reduced by 90%
- [ ] Form auto-fill API response time <500ms

---

## 🚀 Feature 2: Anomaly Detection (P0)

**Goal:** ML-based detection of unusual patterns before they become problems.

### Use Cases

1. **Unusual Order Amounts:**
   - Detects: Order $50,000 when customer typically orders $500
   - Alert: "Order amount 100x higher than average - verify before processing"
   - Prevents: Fraud, data entry errors

2. **Inventory Discrepancies:**
   - Detects: Stock count drops 500 units overnight without shipments
   - Alert: "Inventory discrepancy detected at Brisbane warehouse"
   - Prevents: Theft, unrecorded transfers, system bugs

3. **Pricing Errors:**
   - Detects: Product priced at $1 when cost is $50
   - Alert: "Selling below cost - margin -4900%"
   - Prevents: Revenue loss from pricing mistakes

4. **Supplier Delivery Delays:**
   - Detects: Supplier 14 days late when average is 2 days
   - Alert: "Supplier [Name] delivery significantly delayed"
   - Prevents: Stockouts from unreliable suppliers

5. **POS Payment Failures:**
   - Detects: 5 POS failures in 10 minutes at one location
   - Alert: "High POS failure rate at Sydney - check terminal"
   - Prevents: Revenue loss, customer frustration

### Implementation Plan

#### Backend Components

**1. New Agent: `AnomalyDetectionAgent`**
- **File:** `apps/backend/src/ai/agents/specialized/anomaly_detection_agent.py`

```python
class AnomalyDetectionAgent(BaseAgent):
    """
    Detects anomalies and unusual patterns in business data.

    Uses statistical analysis and ML models to identify outliers
    and alert before issues escalate.
    """

    async def execute(self, task: str, context: dict[str, Any]) -> dict[str, Any]:
        """
        Analyze data for anomalies.

        Context keys:
        - detection_type: "order_amount", "inventory", "pricing", "pos_failures"
        - entity_id: UUID of entity to check
        - data: Recent data points for analysis

        Returns:
        - is_anomaly: Boolean
        - severity: "low", "medium", "high", "critical"
        - description: Human-readable anomaly description
        - recommended_action: What to do next
        - confidence: Float 0-1
        """
        pass

    async def check_order_amount_anomaly(
        self,
        order_id: UUID
    ) -> AnomalyResult:
        """Check if order amount is unusual for customer."""
        # Get customer's last 10 orders
        # Calculate mean, std dev
        # Z-score analysis (|z| > 3 = anomaly)
        pass

    async def check_inventory_discrepancy(
        self,
        product_id: UUID,
        location: str
    ) -> AnomalyResult:
        """Check for unexplained stock changes."""
        # Get stock changes last 24h
        # Compare expected vs actual
        # Flag discrepancies >10%
        pass

    async def check_pricing_error(
        self,
        product_id: UUID
    ) -> AnomalyResult:
        """Check if price is below cost or unreasonably high."""
        # Get product cost and price
        # Calculate margin
        # Flag if margin < 0% or > 200%
        pass
```

**2. API Endpoint: `/api/ai/detect-anomaly`**
- **File:** `apps/backend/src/api/routes/ai/anomaly.py`

```python
@router.post("/detect-anomaly")
async def detect_anomaly(
    request: AnomalyDetectionRequest
) -> AnomalyDetectionResponse:
    """
    Detect anomalies in business data.

    Body:
    {
      "detection_type": "order_amount",
      "entity_id": "uuid",
      "data": {...}
    }

    Returns:
    {
      "is_anomaly": true,
      "severity": "high",
      "description": "Order amount $50,000 is 100x higher than customer average $500",
      "recommended_action": "Verify with customer before processing",
      "confidence": 0.95,
      "historical_data": {...}
    }
    """
    pass
```

**3. Integration Hooks:**
- **Order creation:** Hook into `orders.py` before commit
- **Inventory updates:** Hook into inventory service
- **Product price updates:** Hook into product updates
- **POS transactions:** Hook into POS failure alerts (Phase 4)

#### Frontend Integration

**1. Anomaly Alert Component:**
- **File:** `apps/web/components/alerts/AnomalyAlert.tsx`

```tsx
interface AnomalyAlertProps {
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendedAction: string;
  onDismiss: () => void;
  onAcknowledge: () => void;
}

export function AnomalyAlert({
  severity,
  description,
  recommendedAction,
  onDismiss,
  onAcknowledge
}: AnomalyAlertProps) {
  const icon = severity === "critical" ? AlertTriangle : AlertCircle;
  const variant = severity === "critical" ? "destructive" : "warning";

  return (
    <Alert variant={variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>Anomaly Detected</AlertTitle>
      <AlertDescription>
        {description}
        <div className="mt-2 font-medium">
          Recommended: {recommendedAction}
        </div>
      </AlertDescription>
      <div className="flex gap-2 mt-4">
        <Button size="sm" onClick={onAcknowledge}>Acknowledge</Button>
        <Button size="sm" variant="outline" onClick={onDismiss}>Dismiss</Button>
      </div>
    </Alert>
  );
}
```

**2. Integration Points:**
- `OrderForm.tsx` - Check anomaly on submit, show alert if detected
- `ProductForm.tsx` - Check pricing on price change
- `InventoryPage.tsx` - Background anomaly detection, show badge if issues
- `Dashboard.tsx` - Anomaly summary widget

### Success Metrics

- [ ] Anomaly detection response time <2 seconds
- [ ] 90%+ precision (few false positives)
- [ ] 85%+ recall (catches most anomalies)
- [ ] POS failures detected within 5 minutes
- [ ] 30% reduction in costly errors (fraud, pricing mistakes)

---

## 🚀 Feature 3: Email/Document Parsing (P1)

**Goal:** Automatic order creation from emails and PDF documents.

### Use Cases

1. **Email Order from Customer:**
   - Receives: "Hi, we need 50x SKU-001 and 30x SKU-002. Ship to Sydney warehouse."
   - Extracts: Customer name, products, quantities, delivery location
   - Creates: Draft order with 80% accuracy, user reviews and confirms

2. **PDF Quote from Supplier:**
   - Uploads: Supplier's PDF quote with product list and prices
   - Extracts: Product names/SKUs, quantities, prices, terms
   - Creates: Purchase order draft for approval

3. **Invoice Processing:**
   - Uploads: Customer invoice image
   - Extracts: Invoice number, date, line items, total
   - Reconciles: Against existing orders, flags discrepancies

### Implementation Plan

#### Backend Components

**1. New Agent: `DocumentParserAgent`**
- **File:** `apps/backend/src/ai/agents/specialized/document_parser_agent.py`

```python
class DocumentParserAgent(BaseAgent):
    """
    Parses emails and documents to extract structured order data.

    Uses NLP and OCR to extract customer info, products, quantities,
    and pricing from unstructured text and PDF documents.
    """

    async def execute(self, task: str, context: dict[str, Any]) -> dict[str, Any]:
        """
        Parse document and extract structured data.

        Context keys:
        - document_type: "email", "pdf_quote", "pdf_invoice"
        - content: Email text or PDF file path
        - customer_id: Optional known customer

        Returns:
        - extracted_data: {customer, products, delivery, notes}
        - confidence: Float 0-1
        - unmatched_items: Products not found in catalog
        - validation_errors: Issues found
        """
        pass

    async def parse_email_order(
        self,
        email_body: str,
        sender_email: str
    ) -> ParsedOrder:
        """Extract order from email text."""
        # 1. Identify customer by email
        # 2. Use LLM to extract: products, quantities, delivery
        # 3. Match products against catalog (fuzzy match)
        # 4. Return structured data
        pass

    async def parse_pdf_quote(
        self,
        pdf_path: str
    ) -> ParsedQuote:
        """Extract quote data from PDF."""
        # 1. OCR PDF to text
        # 2. Identify sections (header, line items, totals)
        # 3. Extract structured data
        # 4. Match products
        pass

    async def match_product(
        self,
        description: str,
        sku: str | None = None
    ) -> Product | None:
        """Match description/SKU to catalog product."""
        # Use semantic search (existing SearchAgent)
        pass
```

**2. API Endpoint: `/api/ai/parse-document`**
- **File:** `apps/backend/src/api/routes/ai/document_parser.py`

```python
@router.post("/parse-document")
async def parse_document(
    file: UploadFile = File(None),
    email_body: str = Form(None),
    document_type: str = Form(...)
) -> ParsedDocumentResponse:
    """
    Parse email or PDF to extract order data.

    Form data:
    - file: PDF file (if pdf_quote or pdf_invoice)
    - email_body: Email text (if email)
    - document_type: "email", "pdf_quote", "pdf_invoice"

    Returns:
    {
      "extracted_data": {
        "customer": {...},
        "products": [{sku, quantity, price}],
        "delivery": {...},
        "notes": "..."
      },
      "confidence": 0.85,
      "unmatched_items": ["Product XYZ"],
      "validation_errors": []
    }
    """
    pass
```

#### Frontend Integration

**1. Document Upload Component:**
- **File:** `apps/web/components/forms/DocumentUploader.tsx`

```tsx
export function DocumentUploader({
  documentType,
  onParsed
}: DocumentUploaderProps) {
  const handleUpload = async (file: File | string) => {
    const formData = new FormData();
    if (typeof file === 'string') {
      formData.append('email_body', file);
    } else {
      formData.append('file', file);
    }
    formData.append('document_type', documentType);

    const result = await apiClient.post('/api/ai/parse-document', formData);
    onParsed(result.extracted_data);
  };

  return (
    <div>
      <Input type="file" accept=".pdf" onChange={...} />
      <Textarea placeholder="Or paste email text..." />
      <Button onClick={handleUpload}>Parse Document</Button>
    </div>
  );
}
```

**2. Integration in Forms:**
- `OrderForm.tsx` - "Import from Email" button
- `PurchaseOrderForm.tsx` - "Upload Supplier Quote" button
- New page: `/orders/import` - Bulk email processing

### Success Metrics

- [ ] Email parsing accuracy >80%
- [ ] PDF parsing accuracy >75%
- [ ] Product matching accuracy >90%
- [ ] Order creation time reduced 60% (10min → 4min)
- [ ] 50% reduction in manual data entry errors

---

## 🚀 Feature 4: Inventory Forecasting (P1)

**Goal:** AI-powered demand prediction and proactive reorder recommendations.

### Use Cases

1. **Stock Depletion Prediction:**
   - Analyzes: Sales velocity, seasonal trends, active quotes
   - Predicts: "SKU-001 will run out in 12 days"
   - Recommends: "Reorder 200 units now to maintain 14-day buffer"

2. **Seasonal Demand Forecasting:**
   - Detects: "Building materials sales increase 40% in spring"
   - Predicts: "Stock 300% more concrete in March-May"
   - Optimizes: Inventory levels by season

3. **Safety Stock Recommendations:**
   - Analyzes: Lead time variability, demand volatility
   - Calculates: "Safety stock: 50 units (2 weeks coverage)"
   - Prevents: Stockouts during demand spikes

4. **Auto-Generated Purchase Orders:**
   - Detects: Low stock + predicted depletion
   - Creates: Draft PO for supplier with recommended quantities
   - Notifies: "3 products need reordering this week"

### Implementation Plan

#### Backend Components

**1. New Agent: `InventoryForecastingAgent`**
- **File:** `apps/backend/src/ai/agents/specialized/inventory_forecasting_agent.py`

```python
class InventoryForecastingAgent(BaseAgent):
    """
    Forecasts inventory demand and generates reorder recommendations.

    Uses time series analysis and ML models to predict stock depletion
    and optimize inventory levels.
    """

    async def execute(self, task: str, context: dict[str, Any]) -> dict[str, Any]:
        """
        Generate inventory forecast and recommendations.

        Context keys:
        - product_id: UUID (optional, defaults to all products)
        - location: Warehouse location (optional)
        - forecast_days: Days to forecast (default: 30)

        Returns:
        - forecasts: [{product, predicted_depletion_date, recommended_reorder_date}]
        - reorder_recommendations: [{product, quantity, urgency}]
        - confidence: Float 0-1
        """
        pass

    async def predict_stock_depletion(
        self,
        product_id: UUID,
        location: str
    ) -> StockDepletionForecast:
        """Predict when product will run out."""
        # 1. Get sales history (last 90 days)
        # 2. Calculate sales velocity (units/day)
        # 3. Account for seasonality
        # 4. Factor in active quotes/backorders
        # 5. Calculate depletion date
        pass

    async def calculate_reorder_point(
        self,
        product_id: UUID,
        location: str
    ) -> ReorderRecommendation:
        """Calculate when and how much to reorder."""
        # Formula: Reorder Point = (Avg Daily Sales × Lead Time) + Safety Stock
        # Safety Stock = Z-score × StdDev of demand × √Lead Time
        pass

    async def detect_seasonal_patterns(
        self,
        product_id: UUID
    ) -> SeasonalPattern:
        """Identify seasonal demand patterns."""
        # Analyze sales by month for last 2 years
        # Identify peaks and troughs
        # Return multipliers by month
        pass
```

**2. API Endpoint: `/api/ai/inventory-forecast`**
- **File:** `apps/backend/src/api/routes/ai/inventory_forecast.py`

```python
@router.get("/inventory-forecast")
async def get_inventory_forecast(
    product_id: UUID | None = None,
    location: str | None = None,
    forecast_days: int = Query(30, ge=7, le=90)
) -> InventoryForecastResponse:
    """
    Get inventory forecasts and reorder recommendations.

    Returns:
    {
      "forecasts": [
        {
          "product_id": "uuid",
          "product_name": "...",
          "current_stock": 150,
          "predicted_depletion_date": "2026-02-20",
          "days_until_depletion": 17,
          "recommended_reorder_date": "2026-02-10",
          "recommended_quantity": 200,
          "urgency": "medium",
          "confidence": 0.88
        }
      ],
      "summary": {
        "products_need_reorder_urgent": 3,
        "products_need_reorder_soon": 8,
        "total_forecast_value": 25000
      }
    }
    """
    pass
```

**3. Scheduled Task: Daily Forecast Refresh**
- **File:** `apps/backend/src/scheduler/inventory_forecast_job.py`

```python
async def run_daily_inventory_forecast():
    """
    Run inventory forecasting daily at 2 AM.

    - Forecast all products
    - Send alerts for urgent reorders
    - Update dashboard metrics
    """
    pass
```

#### Frontend Integration

**1. Forecast Dashboard Widget:**
- **File:** `apps/web/components/dashboard/InventoryForecastWidget.tsx`

```tsx
export function InventoryForecastWidget() {
  const [forecast, setForecast] = useState<ForecastSummary | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      const data = await apiClient.get('/api/ai/inventory-forecast');
      setForecast(data.summary);
    };
    fetchForecast();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Urgent Reorders:</span>
            <Badge variant="destructive">{forecast?.products_need_reorder_urgent}</Badge>
          </div>
          <div className="flex justify-between">
            <span>Reorder Soon:</span>
            <Badge variant="warning">{forecast?.products_need_reorder_soon}</Badge>
          </div>
        </div>
        <Button asChild className="mt-4 w-full">
          <Link href="/inventory/forecast">View Forecast</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

**2. Forecast Page:**
- **File:** `apps/web/app/(dashboard)/inventory/forecast/page.tsx`
- **Features:**
  - Table: Product, Current Stock, Predicted Depletion, Recommended Reorder
  - Filters: Location, Urgency, Category
  - Actions: Generate PO, Set reminder, Adjust forecast

**3. Product Page Integration:**
- Show forecast badge on product list: "Runs out in 12 days"
- Add forecast tab to product detail dialog

### Success Metrics

- [ ] Forecast accuracy >80% (within 3 days of actual depletion)
- [ ] Stockouts reduced by 25%
- [ ] Overstock reduced by 15%
- [ ] 50% reduction in manual inventory planning time
- [ ] Auto-generated POs save 30 minutes per week

---

## 📋 Implementation Order

### Sprint 1: P0 Features (Week 1) - 28 hours

**Day 1-2: Smart Form Auto-Fill (16h)**
1. Create `FormAutoFillAgent` agent (6h)
2. Create `/api/ai/form-autofill` endpoint (4h)
3. Build `useFormAutoFill` hook (2h)
4. Integrate in `OrderForm` and `QuoteForm` (3h)
5. Test and refine suggestions (1h)

**Day 3-4: Anomaly Detection (12h)**
1. Create `AnomalyDetectionAgent` agent (5h)
2. Create `/api/ai/detect-anomaly` endpoint (3h)
3. Hook into order creation and POS failures (2h)
4. Build `AnomalyAlert` component (1h)
5. Test with real data (1h)

### Sprint 2: P1 Features (Week 2) - 44 hours

**Day 1-3: Email/Document Parsing (20h)**
1. Create `DocumentParserAgent` agent (8h)
2. Create `/api/ai/parse-document` endpoint (4h)
3. Build `DocumentUploader` component (3h)
4. Integrate in `OrderForm` with import flow (3h)
5. Test with sample emails/PDFs (2h)

**Day 4-5: Inventory Forecasting (24h)**
1. Create `InventoryForecastingAgent` agent (10h)
2. Create `/api/ai/inventory-forecast` endpoint (4h)
3. Build `InventoryForecastWidget` dashboard widget (3h)
4. Create `/inventory/forecast` page (4h)
5. Add scheduled daily forecast job (2h)
6. Test forecasting accuracy (1h)

---

## 🎯 Success Criteria

### Functional Requirements

- [ ] All 4 agents extend `BaseAgent` and register with orchestrator
- [ ] All API endpoints follow existing patterns (Pydantic models, error handling)
- [ ] All frontend components use shadcn/ui and Tailwind CSS
- [ ] Type-check passes (`pnpm run type-check`)
- [ ] Lint passes (`pnpm run lint`)
- [ ] All tests pass (`pnpm run test`)

### Performance Requirements

- [ ] Form auto-fill API response <500ms
- [ ] Anomaly detection API response <2s
- [ ] Document parsing API response <5s (email), <10s (PDF)
- [ ] Inventory forecast API response <3s (single product), <10s (all products)

### Accuracy Requirements

- [ ] Form auto-fill suggestions accepted >80% of the time
- [ ] Anomaly detection precision >90% (few false positives)
- [ ] Document parsing accuracy >80% (email), >75% (PDF)
- [ ] Inventory forecast accuracy >80% (within 3 days)

### Business Impact

- [ ] Order entry time reduced 40% (5min → 3min)
- [ ] Costly errors reduced 30% (fraud, pricing mistakes)
- [ ] Order processing from email 60% faster (10min → 4min)
- [ ] Stockouts reduced 25%

---

## 🧪 Testing Plan

### Unit Tests

**Backend:**
- `test_form_autofill_agent.py` - Test agent logic
- `test_anomaly_detection_agent.py` - Test anomaly detection algorithms
- `test_document_parser_agent.py` - Test parsing logic
- `test_inventory_forecasting_agent.py` - Test forecast calculations

**Frontend:**
- `useFormAutoFill.test.ts` - Test hook behavior
- `AnomalyAlert.test.tsx` - Test alert rendering
- `DocumentUploader.test.tsx` - Test upload flow
- `InventoryForecastWidget.test.tsx` - Test widget rendering

### Integration Tests

- Form auto-fill → Order creation flow
- Anomaly detection → Alert display flow
- Email parsing → Order import flow
- Forecast → PO generation flow

### Manual Testing Scenarios

1. **Auto-Fill:** Create order for repeat customer, verify suggestions
2. **Anomaly:** Create order with unusual amount, verify alert
3. **Parsing:** Upload sample email/PDF, verify extraction accuracy
4. **Forecast:** Check products with low stock, verify reorder recommendations

---

## 📊 Monitoring & Analytics

### Metrics to Track

**Agent Performance:**
- Execution time per agent
- Success/failure rate
- User acceptance rate (suggestions applied)

**Business Impact:**
- Order entry time (before/after)
- Error rate (before/after)
- Stockout events (before/after)
- Time saved per week

### Dashboards

1. **AI Performance Dashboard:**
   - Agent health status
   - Execution metrics
   - User feedback scores

2. **Business Impact Dashboard:**
   - Productivity gains (time saved)
   - Error reduction
   - Cost savings

---

## 🚨 Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Low AI suggestion acceptance | Feature unused | Medium | A/B test, iterate on accuracy |
| False positive anomalies | Alert fatigue | Medium | Tune thresholds, allow feedback |
| Poor document parsing accuracy | Manual fixing required | High | Start with 80% threshold, user review |
| Forecast inaccuracy | Wrong reorder decisions | Medium | Show confidence scores, allow override |

---

## 🎯 Next Steps After Completion

**If AI enhancements succeed:**
1. ✅ Deploy to staging, monitor metrics
2. ✅ Collect user feedback, iterate
3. ✅ Add more AI features (customer chatbot, voice orders)
4. ✅ Consider Phase 3: Enhanced Shopify Backend

**If AI enhancements underperform:**
1. ❌ Analyze why (accuracy, UX, performance)
2. ❌ Tune models, improve prompts
3. ❌ Simplify features, reduce scope
4. ❌ Re-test with real users

---

**End of Implementation Plan**
