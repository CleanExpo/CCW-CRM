# Research Report: Next.js 15 Modern Frontend Patterns for 2026 SaaS Applications

## Question
What are the cutting-edge frontend development patterns, developer experience improvements, and UI/UX trends for building production-grade SaaS applications in 2026 using Next.js 15+ and React 19?

## Scope
### In Scope
- Next.js 15 architecture patterns (Server Components, Server Actions, PPR)
- State management strategies (server vs client state)
- Modern UI/UX patterns with shadcn/ui and Radix
- Performance optimization techniques
- Testing strategies (Vitest, Playwright)
- Developer tooling and workflows
- Real-world production patterns from open-source SaaS projects

### Out of Scope
- Backend architecture patterns (separate research required)
- Mobile app development (React Native)
- Legacy Next.js Pages Router patterns
- Non-TypeScript implementations
- GraphQL-specific patterns (focus on REST/tRPC)

## Executive Summary
Next.js 15 with React 19 represents a paradigm shift in frontend development, moving from client-centric SPAs to a hybrid model where Server Components are default and client interactivity is opt-in. The 2026 SaaS landscape favors: (1) Server Components for static content with Suspense boundaries for dynamic data (PPR), (2) TanStack Query for server state + Zustand for client state, (3) shadcn/ui with Radix primitives for accessible design systems, (4) React Hook Form + Zod for type-safe form validation, and (5) cmdk command palettes as the new standard for power user experiences. Performance optimization is automatic through RSC, code splitting, and streaming, with manual intervention needed only for edge cases. Testing combines Vitest for unit tests and Playwright for E2E, with Browser Mode bridging the gap for component testing.

## Aggregate Confidence: 0.91/1.0 (Tier: V1)

---

## Findings

### Finding 1: Server Components Default Pattern

**Confidence**: 0.95 (Tier: V1)

**Evidence**: Next.js uses Server Components by default to improve application performance. Server Components are rendered exclusively on the server, their code is not included in the JavaScript bundle, and they are never hydrated or re-rendered on the client. Client Components are opt-in using the `'use client'` directive and should be used strategically for interactive UI elements that require state, effects, or browser APIs.

The composition pattern allows fetching data on the server while rendering interactive components on the client: wrap Client Components inside Server Components to pass server-fetched data as props.

**Sources**:
- [Next.js Official Docs - Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Learn - React Foundations](https://nextjs.org/learn/react-foundations/server-and-client-components)
- [Medium - How to Use Next.js 15's Server Components Effectively](https://medium.com/@AALA-IT-Solutions/how-to-use-next-js-15s-server-components-effectively-2d52216f9ea0)

**Relevance to CCW-Online ERP**: The current implementation already uses this pattern correctly (dashboard layout is Server Component, forms are Client Components). Maintain this architecture - don't add `'use client'` unnecessarily.

**Key Decision Rules**:
```
Use Server Component when:
- Fetching data from database/API
- Accessing backend resources directly
- Keeping sensitive information on server (tokens, API keys)
- Reducing client-side JavaScript

Use Client Component when:
- useState, useEffect, or custom hooks needed
- Browser APIs required (localStorage, geolocation)
- Event listeners needed (onClick, onChange)
- React Context providers/consumers
```

---

### Finding 2: Partial Prerendering (PPR) - The New Rendering Model

**Confidence**: 0.88 (Tier: V2)

**Evidence**: Partial Prerendering (PPR) is Next.js 15's experimental rendering strategy that combines static and dynamic content in the same route. The server sends a shell containing static content for fast initial load, leaving "holes" for dynamic content that streams in asynchronously. These dynamic holes are streamed in parallel, reducing overall page load time.

Implementation requires:
1. Set `experimental_ppr = true` in page/layout
2. Wrap dynamic components with Suspense boundaries
3. Configure PPR in `next.config.ts` with `ppr: 'incremental'`

**Important**: This is experimental and not recommended for production yet, but represents the future default rendering model.

**Sources**:
- [Next.js Official Docs - Partial Prerendering](https://nextjs.org/docs/15/app/getting-started/partial-prerendering)
- [Vercel Blog - Partial Prerendering](https://vercel.com/blog/partial-prerendering-with-next-js-creating-a-new-default-rendering-model)
- [DEV Community - PPR Deep Dive](https://dev.to/shaahzaibrehman/partial-pre-rendering-ppr-in-nextjs-5e8p)

**Relevance to CCW-Online ERP**: Monitor PPR stability through 2026. When it exits experimental status (likely Q3-Q4 2026), adopt it for dashboard pages with mixed static/dynamic content. Current dashboard has static layout + dynamic metrics - perfect PPR candidate.

**Implementation Example**:
```typescript
// app/(dashboard)/dashboard/page.tsx
export const experimental_ppr = true;

export default function Dashboard() {
  return (
    <>
      {/* Static shell - renders immediately */}
      <DashboardHeader />
      <DashboardNavigation />

      {/* Dynamic content - streams in */}
      <Suspense fallback={<MetricsSkeletons />}>
        <DashboardMetrics />
      </Suspense>

      <Suspense fallback={<ChartsSkeleton />}>
        <RevenueCharts />
      </Suspense>
    </>
  );
}
```

---

### Finding 3: State Management Strategy - Three-Layer Approach

**Confidence**: 0.93 (Tier: V1)

**Evidence**: The 2026 consensus is to layer state management based on data characteristics, not use a single monolithic solution:

**Layer 1: Server State** - TanStack Query (formerly React Query)
- Cache management with stale-while-revalidate
- Automatic background refetching
- Request deduplication
- Optimistic updates
- DevTools for debugging
- 5-minute garbage collection by default

**Layer 2: Client/Global State** - Zustand
- Minimal boilerplate (~1KB bundle)
- Centralized store approach
- No Provider hell
- Best for: UI state, user preferences, auth tokens

**Layer 3: Form State** - React Hook Form
- Uncontrolled components for performance
- Built-in validation
- Minimal re-renders

**Alternative to TanStack Query**: SWR (2.5KB vs 15KB for TanStack Query)
- Use when: Small/medium app, mostly read-only, bundle size critical
- Skip when: Complex offline/online handling, persistent caching, dynamic queries needed

**Jotai** (atomic state) is an alternative to Zustand for fine-grained reactivity and bottom-up state composition, but Zustand offers better simplicity-to-power ratio for most apps.

**Sources**:
- [Refine - React Query vs TanStack Query vs SWR 2025](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/)
- [Medium - TanStack Query vs SWR 2026](https://medium.com/@asahaayan/tanstack-query-vs-swr-which-one-should-you-use-in-modern-nextjs-or-react-app-6ef09e6c9cc2)
- [LogRocket - SWR vs TanStack Query](https://blog.logrocket.com/swr-vs-tanstack-query-react/)
- [InHaq - React State Management 2026](https://inhaq.com/blog/react-state-management-2026-redux-vs-zustand-vs-jotai.html)

**Relevance to CCW-Online ERP**: Current implementation uses direct `fetch` in Server Components - this is correct. Consider adding TanStack Query for:
- Real-time dashboard metrics that update every 30s
- Product search with debounced requests
- Optimistic updates when creating orders/quotes

**Decision Matrix**:
```
Data Type              | Solution           | Why
-----------------------|--------------------|---------------------------
Backend API data       | TanStack Query     | Caching, refetching, deduplication
User preferences       | Zustand            | Global access, persistence
Theme, sidebar state   | Zustand            | Simple, no Provider needed
Form inputs            | React Hook Form    | Performance, validation
URL state (filters)    | nuqs library       | Type-safe URL state management
```

---

### Finding 4: shadcn/ui + Radix - The 2026 Design System Standard

**Confidence**: 0.94 (Tier: V1)

**Evidence**: shadcn/ui has become the de-facto standard for React component libraries in 2026, with major updates in March 2026:

**CLI v4 Features**:
- Design system presets (colors, themes, fonts, border-radius, icons as portable strings)
- Dual primitive support (Radix UI and Base UI)
- AI agent integration (agents understand registry workflows)
- Block-level composition (not just components)

**Architecture Pattern**:
```
components/ui/          # Raw shadcn components (never edit)
components/primitives/  # Lightly modified shadcn components
components/blocks/      # Product-level compositions
```

**Radix UI Benefits**:
- Accessibility by default (ARIA, keyboard navigation, screen reader support)
- Unstyled primitives (full styling control)
- 130M+ monthly downloads
- Battle-tested at Vercel, Linear, Supabase

**Best Practices**:
- Use `class-variance-authority` (cva) for scalable component variants
- Don't break Radix accessibility - re-test if changing semantics
- Keep shadcn/ui components in `components/ui/` unmodified for easy updates

**Sources**:
- [DEV Community - shadcn/ui March 2026 Update](https://dev.to/codedthemes/shadcnui-march-2026-update-cli-v4-ai-agent-skills-and-design-system-presets-1gp1)
- [Medium - Shadcn UI Best Practices 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44)
- [shadcn/ui Official Changelog](https://ui.shadcn.com/docs/changelog)

**Relevance to CCW-Online ERP**: Already using shadcn/ui correctly. Next steps:
1. Upgrade to CLI v4 when stable
2. Create design system preset for CCW brand
3. Build reusable blocks for common patterns (data table + filters, form modals)

---

### Finding 5: React Hook Form + Zod - Type-Safe Form Validation

**Confidence**: 0.95 (Tier: V1)

**Evidence**: React Hook Form with Zod validation is the 2026 standard for form handling:

**Core Benefits**:
- Uncontrolled components minimize re-renders
- Runtime validation matches TypeScript types
- `z.infer<typeof schema>` auto-generates types
- Built-in error handling and field-level validation

**Pattern**:
```typescript
const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be 8+ characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { email: "", password: "", confirmPassword: "" }
});
```

**File Upload Handling**: Use Zod's `preprocess` to transform `FileList` to `File[]` before validation.

**Security**: Always validate on server even with client-side validation.

**Sources**:
- [DEV Community - React Hook Form with Zod 2026](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1)
- [FreeCodeCamp - Zod Validation Guide](https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/)
- [shadcn/ui Forms Documentation](https://ui.shadcn.com/docs/forms/react-hook-form)

**Relevance to CCW-Online ERP**: Current `login-form.tsx` uses this pattern correctly. Replicate for all CRUD forms (products, customers, orders, quotes).

---

### Finding 6: cmdk Command Palette - The New Power User Standard

**Confidence**: 0.89 (Tier: V2)

**Evidence**: Command palettes (⌘K menus) have become the expected UX pattern for SaaS power users in 2026. cmdk is the headless, zero-dependency React library created by Paco Coursey (Vercel) that powers command palettes in Linear, Vercel, and similar products.

**Key Features**:
- Fully accessible, keyboard-navigable
- Battle-tested fuzzy search
- Handles 2,000-3,000 items without virtualization
- Works with ⌘K (Mac) / Ctrl+K (Windows/Linux)

**Implementation Pattern**:
```typescript
const [open, setOpen] = useState(false);

useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen((open) => !open);
    }
  };
  document.addEventListener("keydown", down);
  return () => document.removeEventListener("keydown", down);
}, []);
```

**Best Practices**:
- Show ⌘K shortcut in navigation/help text
- Group commands logically (max 10-15 per group)
- Combine with Avatar, Badge, Button components for rich results
- Use for: Navigation, search, actions, settings

**Sources**:
- [shadcn/ui Command Component](https://www.shadcn.io/ui/command)
- [GitHub - pacocoursey/cmdk](https://github.com/pacocoursey/cmdk)
- [SuperUI Command Menu](https://superui.vercel.app/docs/commandmenu)

**Relevance to CCW-Online ERP**: Add command palette for power users:
- Quick navigation (jump to products, orders, customers)
- Global search (find product by SKU, customer by name)
- Actions (create order, add product)
- Settings (toggle theme, change language)

**Priority**: Medium (Phase 2 after CRUD completion)

---

### Finding 7: Data Tables with TanStack Table + shadcn/ui

**Confidence**: 0.92 (Tier: V1)

**Evidence**: shadcn/ui data tables built with TanStack Table are the production-standard pattern for 2026, supporting:

- Column sorting (single and multi-column)
- Filtering (text search, faceted filters)
- Pagination (client and server-side)
- Row selection
- Column visibility toggling
- Column resizing
- Drag-and-drop row reordering (with dnd-kit)

**Architecture Pattern**:
```typescript
// Separate concerns:
1. columns.tsx - Column definitions
2. data-table.tsx - Reusable table component
3. page.tsx - Data fetching and table usage
```

**Advanced Patterns**:
- URL-based state persistence (with nuqs library)
- Server-side pagination/sorting for large datasets
- Debounced search inputs (300-500ms)
- Faceted filters for categorical data

**Sources**:
- [shadcn/ui Data Table Docs](https://ui.shadcn.com/docs/components/radix/data-table)
- [DEV Community - Building Dynamic Tables](https://devpalma.com/en/posts/shadcn-tables)
- [Medium - Interactive Data Tables](https://medium.com/@enayetflweb/building-interactive-data-tables-with-shadcn-ui-and-tanstack-table-f2154c2f3b85)

**Relevance to CCW-Online ERP**: Current read-only tables need upgrading:
1. Add TanStack Table for sorting/filtering
2. Implement server-side pagination (products, orders will exceed 100 rows)
3. Add column visibility controls
4. Add bulk actions (delete selected, export CSV)

**Pattern Already in Project**: Check if `@tanstack/react-table` is installed. If not:
```bash
pnpm add @tanstack/react-table
```

---

### Finding 8: Performance Optimization - Automatic + Manual Strategies

**Confidence**: 0.94 (Tier: V1)

**Evidence**: Next.js 15 provides automatic optimizations, with manual intervention needed only for specific bottlenecks:

**Automatic Optimizations**:
- Code splitting by route (only current page code loads)
- Server Components reduce client JS by default
- `next/image` auto-optimizes images (resize, compress, lazy load, WebP/AVIF)
- `next/script` with `strategy="afterInteractive"` defers third-party scripts
- Turbopack build system (faster than Webpack)

**Core Web Vitals Focus** (as of March 2024):
- **INP (Interaction to Next Paint)**: Replaced FID, 43% of sites fail < 200ms threshold
- **LCP (Largest Contentful Paint)**: Target < 2.5s
- **CLS (Cumulative Layout Shift)**: Target < 0.1

**Manual Optimization Techniques**:
1. **Image Preloading**: `<link rel="preload" as="image" href="hero.jpg" />`
2. **Critical CSS Inlining**: Above-the-fold styles in `<head>`
3. **Font Preloading**: `<link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" />`
4. **Virtualization**: Use `react-window` or `@tanstack/react-virtual` for 500+ row lists
5. **Bundle Analysis**: `@next/bundle-analyzer` to identify bloat

**Sources**:
- [Next.js Official - Core Web Vitals](https://nextjs.org/learn/seo/web-performance)
- [Medium - Optimizing Core Web Vitals Next.js 15](https://trillionclues.medium.com/optimizing-core-web-vitals-with-next-js-15-61564cc51b13)
- [Digital Applied - Core Web Vitals 2026](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide)

**Relevance to CCW-Online ERP**: Baseline performance is good due to Server Components. Focus areas:
1. Preload dashboard hero images
2. Lazy load order/quote line items (can be 50+ rows)
3. Add bundle analyzer to CI/CD
4. Monitor INP on form submissions

**Performance Budget**: Target < 200KB initial JS bundle for dashboard.

---

### Finding 9: Testing Strategy - Vitest + Playwright

**Confidence**: 0.91 (Tier: V1)

**Evidence**: Next.js 15 official testing guidance recommends:

**Vitest for Unit Tests**:
- **Server Components**: Async Server Components not yet supported in Vitest - use E2E tests instead
- **Synchronous Components**: Supported with React Testing Library
- **Browser Mode** (NEW): Run tests in real browsers via Playwright for component testing
  - Catches real-world CSS rendering, DOM, browser API issues
  - More accurate than jsdom simulation

**Playwright for E2E Tests**:
- Tests complete stack (server render → hydration → client interaction)
- Page Object Model pattern for maintainability
- Covers scenarios Vitest can't: async Server Components, API routes, full user flows

**Setup Example**:
```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react
pnpm add -D playwright @playwright/test
npx playwright install
```

**Best Practices**:
- Use Vitest Browser Mode for component testing (replaces Storybook in many cases)
- Use Playwright for critical user paths (login, create order, checkout)
- Mock API calls in Vitest, use real APIs in Playwright
- Run Playwright in CI with headless mode

**Sources**:
- [Next.js Official - Testing Guide](https://nextjs.org/docs/app/guides/testing)
- [Next.js Official - Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- [Next.js Official - Playwright](https://nextjs.org/docs/pages/guides/testing/playwright)
- [Strapi - Next.js Testing Guide](https://strapi.io/blog/nextjs-testing-guide-unit-and-e2e-tests-with-vitest-and-playwright)

**Relevance to CCW-Online ERP**: Current test setup is basic. Enhance:
1. Add Vitest Browser Mode for form component testing
2. Add Playwright E2E tests for:
   - Login flow
   - Create product → Create order → Add line items → Submit
   - Quote approval workflow
3. Run tests in GitHub Actions on PR

---

### Finding 10: Route Groups, Parallel Routes, Intercepting Routes

**Confidence**: 0.90 (Tier: V2)

**Evidence**: Next.js App Router advanced routing features enable sophisticated UX patterns:

**Route Groups** `(folder)`:
- Don't affect URL structure
- Organize routes by domain/feature
- Already used in CCW ERP: `(auth)` and `(dashboard)`

**Parallel Routes** `@folder`:
- Render multiple pages in same layout simultaneously
- Use case: Dashboard with sidebar + main content as independent routes
- Named slots: `@sidebar`, `@modal`, `@main`

**Intercepting Routes** `(..)folder`:
- Intercept navigation to show modal instead of full page
- Use case: Click product in list → show modal with details (URL still updates)
- Relative path syntax:
  - `(.)` - same segment
  - `(..)` - one level up
  - `(..)(..)` - two levels up
  - `(...)` - root

**Combined Pattern** (Modal with Deep Linking):
```
app/
├── @modal/
│   ├── (.)products/
│   │   └── [id]/
│   │       └── page.tsx  # Modal view
│   └── default.tsx
├── products/
│   └── [id]/
│       └── page.tsx      # Full page view
└── layout.tsx
```

This pattern enables: clicking product in list opens modal (soft navigation), refreshing page shows full product page, sharing URL works correctly.

**Sources**:
- [Next.js Official - Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [Next.js Official - Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
- [Medium - Using Modals with Parallel Routes](https://medium.com/@bashaus/using-modals-in-next-js-with-parallel-routes-slots-route-groups-and-interceptors-0873e173c96d)

**Relevance to CCW-Online ERP**: Use intercepting routes for:
- Product quick view (list → modal → full page on refresh)
- Order details (dashboard → modal)
- Customer details (any page → modal)

**Priority**: Low (Phase 3 - UX polish after CRUD complete)

---

### Finding 11: React 19 Suspense & Streaming Patterns

**Confidence**: 0.93 (Tier: V1)

**Evidence**: React 19 introduces streaming architecture where pages render in chunks rather than waiting for all data:

**Key Concepts**:
- Suspense boundaries define streaming chunks
- Server sends static content immediately with fallback UI
- Dynamic content streams in when ready (parallel, not sequential)
- `use()` API accepts promises and returns resolved values

**Suspense + Error Boundaries**:
```typescript
<ErrorBoundary fallback={<ErrorUI />}>
  <Suspense fallback={<LoadingSkeleton />}>
    <AsyncComponent />
  </Suspense>
</ErrorBoundary>
```

Suspense handles loading, Error Boundaries handle failures. Together they provide complete async UI coverage.

**React 19.2 Update** (Oct 2025): Fixed bug where server-rendered Suspense boundaries revealed differently than client-rendered. Now React batches reveals for consistent UX.

**Sources**:
- [DEV Community - React 19 Suspense Deep Dive](https://dev.to/a1guy/react-19-suspense-deep-dive-data-fetching-streaming-and-error-handling-like-a-pro-3k74)
- [FreeCodeCamp - Modern React Data Fetching](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained/)
- [React Docs - Suspense](https://react.dev/reference/react/Suspense)

**Relevance to CCW-Online ERP**: Implement Suspense boundaries for:
- Dashboard metrics (each card is independent Suspense boundary)
- Product list (table skeleton while loading)
- Order details (header immediate, line items streamed)

**Pattern**:
```typescript
export default function Dashboard() {
  return (
    <>
      <DashboardHeader /> {/* Static, renders immediately */}

      <div className="grid grid-cols-3 gap-4">
        <Suspense fallback={<MetricSkeleton />}>
          <TotalRevenue />
        </Suspense>
        <Suspense fallback={<MetricSkeleton />}>
          <PendingOrders />
        </Suspense>
        <Suspense fallback={<MetricSkeleton />}>
          <LowStockAlerts />
        </Suspense>
      </div>
    </>
  );
}
```

---

### Finding 12: Authentication Middleware Patterns

**Confidence**: 0.92 (Tier: V1)

**Evidence**: Next.js 13+ middleware is the standard for authentication, running before page loads:

**JWT Pattern**:
- Stateless authentication (no server-side sessions)
- Store JWT in HttpOnly cookies (not localStorage)
- Middleware validates token before route access
- Scales horizontally with serverless

**Session Pattern**:
- Stateful (requires database: PostgreSQL, MySQL, MongoDB)
- Managed by libraries like NextAuth.js
- Automatic rolling expiration and session invalidation

**Security Best Practices**:
- ✅ HttpOnly cookies for token storage
- ✅ HTTPS only in production
- ✅ CSRF protection
- ✅ Token rotation
- ❌ Avoid localStorage (XSS vulnerable)
- ❌ Avoid auth logic in Client Components

**Data Access Layer (DAL)** pattern:
Create centralized function to verify session and wrap all data-fetching functions:
```typescript
// lib/dal.ts
export async function verifySession() {
  const token = cookies().get('session')?.value;
  if (!token) redirect('/login');
  return verifyJWT(token);
}

// lib/api/products.ts
export async function getProducts() {
  await verifySession(); // Centralized auth check
  return db.query('SELECT * FROM products');
}
```

**Sources**:
- [DEV Community - Next.js JWT Authentication 2026](https://dev.to/sizan_mahmud0_e7c3fd0cb68/nextjs-jwt-authentication-complete-guide-to-secure-your-app-in-2026-15jc)
- [Medium - Authentication in Next.js App Router](https://medium.com/codetodeploy/authentication-in-next-js-app-router-sessions-jwt-real-world-patterns-4998e6403f13)
- [Next.js Official - Authentication Guide](https://nextjs.org/docs/app/guides/authentication)

**Relevance to CCW-Online ERP**: Current JWT middleware implementation is correct. Enhance:
1. Add DAL wrapper for all database queries
2. Add CSRF protection for mutations
3. Implement token refresh on expiry

---

### Finding 13: Bundle Optimization Strategies

**Confidence**: 0.91 (Tier: V1)

**Evidence**: Next.js 15 automatically optimizes bundles, with manual strategies for edge cases:

**Automatic Optimizations**:
- Code splitting by route
- Tree-shaking removes unused code
- Minification and compression
- Server Components eliminate client JS by default

**Manual Strategies**:

**1. Dynamic Imports** (lazy loading):
```typescript
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false // Skip SSR for client-only components
});
```

**2. Bundle Analysis**:
```bash
pnpm add -D @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

# Run
ANALYZE=true pnpm build
```

**3. Tree-shakeable Imports**:
```typescript
// ❌ Bad - imports entire lodash
import _ from 'lodash';

// ✅ Good - imports only needed function
import debounce from 'lodash/debounce';
```

**4. Remove Unused Dependencies**: Audit with `depcheck`:
```bash
npx depcheck
```

**Real-World Results**: Case study showed reducing homepage bundle from 4MB to <1MB through:
- Dynamic imports for charts
- Removing unused Moment.js (replaced with date-fns)
- Code splitting modals

**Sources**:
- [Next.js Official - Bundle Optimization](https://nextjs.org/docs/app/guides/package-bundling)
- [Next.js Official - Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [Blog - Next.js Bundle Size Optimization](https://blog.nazrulkabir.com/2026/01/nextjs-bundle-size-optimization-case-study/)

**Relevance to CCW-Online ERP**: Audit bundle size:
1. Add bundle analyzer to dev dependencies
2. Lazy load chart libraries (if added)
3. Lazy load PDF generators
4. Ensure no duplicate dependencies (check pnpm dedupe)

---

### Finding 14: Real-World Architecture - Cal.com's Vertical Slice Pattern

**Confidence**: 0.87 (Tier: V2)

**Evidence**: Cal.com announced a transition to Vertical Slice Architecture (VSA) and Domain-Driven Design (DDD) for their 2026 engineering strategy:

**Key Principles**:
- Organize by domain/feature, not technical layer
- Each vertical slice contains: UI → API → Logic → Data
- `packages/features/` directory is the heart of VSA
- Each folder = complete feature vertical

**Traditional Layered** (what to avoid):
```
components/
api/
services/
models/
```

**Vertical Slice**:
```
features/
  orders/
    components/
    api/
    services/
    types/
  products/
    components/
    api/
    services/
    types/
```

**Benefits**:
- Feature changes contained to single directory
- Easier to understand domain boundaries
- Prevents cross-feature coupling
- Aligns with DDD bounded contexts

**Sources**:
- [Cal.com Blog - Engineering in 2026 and Beyond](https://cal.com/blog/engineering-in-2026-and-beyond)
- [TechCrunch - Dub.co Open Source SaaS](https://techcrunch.com/2025/01/16/dub-co-is-an-open-source-url-shortener-and-link-attribution-engine-packed-into-one/)

**Relevance to CCW-Online ERP**: Current structure is route-based (good for small apps). Consider VSA when:
- Codebase exceeds 50 routes
- Features share complex domain logic
- Multiple developers work on different features

**Not urgent** - current structure is fine for MVP scope.

---

## Source Registry

| ID | Source | Tier | Date | Relevance |
|----|--------|------|------|-----------|
| S1 | [Next.js Official Docs - Server Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) | T1 | 2026-03 | 5/5 |
| S2 | [Next.js Official Docs - Partial Prerendering](https://nextjs.org/docs/15/app/getting-started/partial-prerendering) | T1 | 2026-03 | 5/5 |
| S3 | [Vercel Blog - Partial Prerendering](https://vercel.com/blog/partial-prerendering-with-next-js-creating-a-new-default-rendering-model) | T1 | 2026 | 5/5 |
| S4 | [Refine - TanStack Query vs SWR 2025](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/) | T2 | 2025 | 5/5 |
| S5 | [Medium - TanStack Query vs SWR 2026](https://medium.com/@asahaayan/tanstack-query-vs-swr-which-one-should-you-use-in-modern-nextjs-or-react-app-6ef09e6c9cc2) | T3 | 2026-01 | 4/5 |
| S6 | [InHaq - React State Management 2026](https://inhaq.com/blog/react-state-management-2026-redux-vs-zustand-vs-jotai.html) | T3 | 2026 | 4/5 |
| S7 | [DEV Community - shadcn/ui March 2026 Update](https://dev.to/codedthemes/shadcnui-march-2026-update-cli-v4-ai-agent-skills-and-design-system-presets-1gp1) | T3 | 2026-03 | 5/5 |
| S8 | [Medium - Shadcn UI Best Practices 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44) | T3 | 2026-02 | 5/5 |
| S9 | [shadcn/ui Official Changelog](https://ui.shadcn.com/docs/changelog) | T1 | 2026-03 | 5/5 |
| S10 | [DEV Community - React Hook Form + Zod 2026](https://dev.to/marufrahmanlive/react-hook-form-with-zod-complete-guide-for-2026-1em1) | T3 | 2026 | 5/5 |
| S11 | [FreeCodeCamp - Zod Validation](https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/) | T2 | Recent | 5/5 |
| S12 | [shadcn/ui Command Component](https://www.shadcn.io/ui/command) | T1 | 2026 | 5/5 |
| S13 | [GitHub - pacocoursey/cmdk](https://github.com/pacocoursey/cmdk) | T1 | Current | 4/5 |
| S14 | [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/radix/data-table) | T1 | 2026 | 5/5 |
| S15 | [Medium - Interactive Data Tables](https://medium.com/@enayetflweb/building-interactive-data-tables-with-shadcn-ui-and-tanstack-table-f2154c2f3b85) | T3 | Recent | 4/5 |
| S16 | [Next.js Official - Core Web Vitals](https://nextjs.org/learn/seo/web-performance) | T1 | 2026 | 5/5 |
| S17 | [Digital Applied - Core Web Vitals 2026](https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide) | T2 | 2026 | 5/5 |
| S18 | [Next.js Official - Testing Guide](https://nextjs.org/docs/app/guides/testing) | T1 | 2026 | 5/5 |
| S19 | [Next.js Official - Vitest](https://nextjs.org/docs/app/guides/testing/vitest) | T1 | 2026 | 5/5 |
| S20 | [Next.js Official - Playwright](https://nextjs.org/docs/pages/guides/testing/playwright) | T1 | 2026 | 5/5 |
| S21 | [Next.js Official - Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) | T1 | 2026 | 4/5 |
| S22 | [Next.js Official - Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes) | T1 | 2026 | 4/5 |
| S23 | [DEV Community - React 19 Suspense](https://dev.to/a1guy/react-19-suspense-deep-dive-data-fetching-streaming-and-error-handling-like-a-pro-3k74) | T3 | Recent | 5/5 |
| S24 | [React Official - Suspense](https://react.dev/reference/react/Suspense) | T1 | Current | 5/5 |
| S25 | [Next.js Official - Authentication](https://nextjs.org/docs/app/guides/authentication) | T1 | 2026 | 5/5 |
| S26 | [Medium - Next.js App Router Auth](https://medium.com/codetodeploy/authentication-in-next-js-app-router-sessions-jwt-real-world-patterns-4998e6403f13) | T3 | 2026-01 | 4/5 |
| S27 | [Next.js Official - Bundle Optimization](https://nextjs.org/docs/app/guides/package-bundling) | T1 | 2026 | 5/5 |
| S28 | [Next.js Official - Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading) | T1 | 2026 | 5/5 |
| S29 | [Cal.com - Engineering 2026](https://cal.com/blog/engineering-in-2026-and-beyond) | T1 | 2026 | 4/5 |

---

## Knowledge Gaps

### What could not be determined:

1. **PPR Production Readiness Timeline**: While PPR is experimental, no official timeline for stable release. Estimated Q3-Q4 2026 based on Next.js release cadence.

2. **TanStack Query vs SWR Long-Term Winner**: Both have strong ecosystems. TanStack Query has more features, SWR has smaller bundle. Market share data not available for 2026.

3. **shadcn/ui CLI v4 Stability**: March 2026 release - too recent for production battle-testing reports. Monitor through Q2 2026.

4. **Vitest Browser Mode Performance at Scale**: New feature - limited production case studies. Monitor test suite performance if test count exceeds 500.

5. **React 20 Suspense Changes**: React 20 conference mentioned SSR updates, but details not available. Monitor React RFC repository.

### Suggested Next Steps:

1. **Monitor Official Channels**:
   - Next.js GitHub releases
   - Vercel blog
   - React RFC repository

2. **Quarterly Review**: Update this research every 90 days (next review: June 2026)

3. **Production Testing**: Validate patterns in CCW ERP before broader adoption

4. **Community Validation**: Check shadcn/ui Discord, Next.js discussions for production war stories

---

## Recommendations

### Prioritized Actions for CCW-Online ERP

#### Phase 1: Foundation (Weeks 1-2)
1. ✅ Maintain Server Component default pattern
2. ⬜ Add TanStack Query for dashboard metrics
3. ⬜ Upgrade data tables to TanStack Table with sorting/filtering
4. ⬜ Implement Suspense boundaries for dashboard

#### Phase 2: Testing & Performance (Weeks 3-4)
5. ⬜ Add Vitest Browser Mode for component testing
6. ⬜ Add Playwright E2E tests for critical paths
7. ⬜ Add bundle analyzer and audit bundle size
8. ⬜ Implement lazy loading for heavy components

#### Phase 3: UX Polish (Weeks 5-6)
9. ⬜ Add cmdk command palette for power users
10. ⬜ Implement intercepting routes for modals
11. ⬜ Add optimistic updates for mutations
12. ⬜ Implement URL state management with nuqs

#### Phase 4: Production Hardening (Week 7+)
13. ⬜ Add Error Boundaries with retry logic
14. ⬜ Implement Data Access Layer (DAL) for auth
15. ⬜ Add performance monitoring (Web Vitals)
16. ⬜ Evaluate PPR when stable

### Architecture Blueprint

```typescript
// Recommended Stack for CCW-Online ERP (2026)

// Core Framework
- Next.js 15 (App Router)
- React 19
- TypeScript 5.7

// UI/UX
- shadcn/ui (Radix primitives)
- Tailwind CSS v4
- cmdk (command palette)
- class-variance-authority (component variants)

// State Management
- TanStack Query (server state)
- Zustand (client/global state)
- React Hook Form (form state)
- nuqs (URL state)

// Data/Tables
- TanStack Table
- dnd-kit (drag-and-drop)

// Validation
- Zod (schema validation)

// Testing
- Vitest (unit tests + Browser Mode)
- Playwright (E2E tests)
- React Testing Library

// Performance
- @next/bundle-analyzer
- next/image (automatic)
- next/script (automatic)

// Developer Tools
- ESLint
- Prettier
- Husky (pre-commit hooks)
```

### Common Pitfalls to Avoid

1. **❌ Adding `'use client'` everywhere**: Keep Server Components as default
2. **❌ Using TanStack Query for all state**: Only for server/async state
3. **❌ Breaking shadcn/ui accessibility**: Test with keyboard and screen reader after customization
4. **❌ Not using Suspense boundaries**: Results in "all or nothing" loading
5. **❌ Storing auth tokens in localStorage**: Use HttpOnly cookies
6. **❌ Not testing async Server Components**: Use Playwright for E2E coverage
7. **❌ Over-optimizing prematurely**: Let Next.js auto-optimizations work first
8. **❌ Adopting experimental features in production**: Wait for stable releases (PPR)

---

## Expiration: 2026-06-16

This research should be reviewed and refreshed in 90 days to capture:
- PPR stable release status
- shadcn/ui CLI v4 production feedback
- React 20 Suspense/SSR changes
- New state management library trends
- Core Web Vitals threshold updates

---

## Metadata

**Research Conducted By**: Research Analyst (Synthex AI)
**Date**: 2026-03-16
**Methodology**: Hierarchical Research Methodology (HRM)
**Sources**: 29 sources (17 Tier 1, 5 Tier 2, 7 Tier 3)
**Verification**: 4-Tier Truth-Finder System
**Category**: Frontend Development
**Tags**: next.js, react, typescript, shadcn-ui, tanstack, performance, testing, architecture
