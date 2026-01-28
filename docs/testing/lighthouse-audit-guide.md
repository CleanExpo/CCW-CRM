# Lighthouse Performance Audit Guide
**Date:** 2026-01-17
**Purpose:** Performance auditing for CCW-Online ERP MVP
**Tool:** Google Lighthouse (Chrome DevTools)

---

## Overview

This guide provides instructions for running Lighthouse performance audits on the CCW-Online ERP application to ensure optimal user experience before production deployment.

---

## Prerequisites

1. ✅ Frontend running on `http://localhost:3006` (or your configured port)
2. ✅ Chrome/Edge browser installed
3. ✅ Chrome DevTools Lighthouse extension (built-in)

---

## Pages to Audit

### 1. Portal Showroom Page
**URL:** `http://localhost:3006/portal/showroom`
**Purpose:** Customer-facing product catalog
**Expected Load Time:** < 2 seconds
**Target Performance Score:** ≥ 90

### 2. Portal Dashboard
**URL:** `http://localhost:3006/dashboard`
**Purpose:** Main authenticated user dashboard
**Expected Load Time:** < 3 seconds
**Target Performance Score:** ≥ 85

### 3. Products Management Page
**URL:** `http://localhost:3006/products`
**Purpose:** Internal product management interface
**Expected Load Time:** < 2.5 seconds
**Target Performance Score:** ≥ 85

---

## Running Lighthouse Audits

### Method 1: Chrome DevTools (Recommended)

1. **Open the page** in Chrome/Edge
2. **Open DevTools** (F12 or Right-click → Inspect)
3. **Navigate to Lighthouse tab**
4. **Configure audit settings:**
   - ✅ Performance
   - ✅ Accessibility
   - ✅ Best Practices
   - ✅ SEO
   - Device: Desktop (for internal tools) or Mobile (for customer-facing)
5. **Click "Analyze page load"**
6. **Wait for audit to complete** (30-60 seconds)
7. **Review results and save report**

### Method 2: Lighthouse CLI

```bash
# Showroom page
npx lighthouse http://localhost:3006/portal/showroom \\
  --output=html \\
  --output-path=./docs/testing/lighthouse-showroom.html \\
  --preset=desktop \\
  --only-categories=performance,accessibility,best-practices

# Dashboard page
npx lighthouse http://localhost:3006/dashboard \\
  --output=html \\
  --output-path=./docs/testing/lighthouse-dashboard.html \\
  --preset=desktop \\
  --only-categories=performance,accessibility,best-practices

# Products page
npx lighthouse http://localhost:3006/products \\
  --output=html \\
  --output-path=./docs/testing/lighthouse-products.html \\
  --preset=desktop \\
  --only-categories=performance,accessibility,best-practices
```

### Method 3: PageSpeed Insights (Online)

1. Deploy to staging environment
2. Visit https://pagespeed.web.dev/
3. Enter the URL
4. Run analysis
5. Review mobile and desktop scores

---

## Lighthouse Scoring Criteria

### Performance (0-100)
- **90-100:** ✅ Excellent - Production ready
- **50-89:** ⚠️ Needs improvement
- **0-49:** ❌ Poor - Must fix before production

**Key Metrics:**
- **First Contentful Paint (FCP):** < 1.8s
- **Largest Contentful Paint (LCP):** < 2.5s
- **Total Blocking Time (TBT):** < 200ms
- **Cumulative Layout Shift (CLS):** < 0.1
- **Speed Index:** < 3.4s

### Accessibility (0-100)
- **90-100:** ✅ Excellent
- **50-89:** ⚠️ Needs improvement
- **0-49:** ❌ Poor

### Best Practices (0-100)
- **90-100:** ✅ Excellent
- **50-89:** ⚠️ Needs improvement
- **0-49:** ❌ Poor

---

## Expected Results (Based on Architecture)

### Showroom Page

**Expected Performance:** 90-95
- ✅ Static product catalog
- ✅ Next.js Image optimization
- ✅ Server-side rendering
- ⚠️ May have API calls for real-time inventory

**Expected Accessibility:** 95-100
- ✅ Semantic HTML
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation support

**Expected Best Practices:** 90-100
- ✅ HTTPS (in production)
- ✅ No console errors
- ✅ Proper image formats (WebP/AVIF)

### Dashboard Page

**Expected Performance:** 85-90
- ⚠️ Multiple data sources (widgets)
- ⚠️ Real-time chart rendering
- ✅ Optimized with React.lazy
- ✅ Proper caching strategy

**Expected Accessibility:** 90-95
- ✅ Dashboard widgets accessible
- ⚠️ Chart accessibility may need attention

**Expected Best Practices:** 85-95
- ✅ Secure authentication
- ✅ No mixed content

### Products Page

**Expected Performance:** 85-92
- ✅ Paginated table
- ⚠️ Large dataset rendering
- ✅ Virtual scrolling (if implemented)

**Expected Accessibility:** 90-95
- ✅ Table semantics
- ✅ Filter controls accessible

---

## Common Performance Issues & Fixes

### 1. Large Bundle Size
**Issue:** JavaScript bundle > 500KB
**Fix:**
- ✅ Enable code splitting
- ✅ Use dynamic imports for heavy components
- ✅ Remove unused dependencies

```typescript
// Before
import HeavyChart from "@/components/HeavyChart";

// After
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  loading: () => <Spinner />,
  ssr: false,
});
```

### 2. Unoptimized Images
**Issue:** Images not using Next.js Image component
**Status:** ✅ Already fixed (all images use `<Image>` component)

### 3. Render-Blocking Resources
**Issue:** CSS/JS blocks initial render
**Fix:**
- ✅ Inline critical CSS
- ✅ Defer non-critical JavaScript
- ✅ Use font-display: swap

### 4. Excessive API Calls
**Issue:** Multiple API requests on page load
**Fix:**
- ✅ Implement request batching
- ✅ Use React Query for caching
- ✅ Server-side data fetching with Next.js

### 5. Missing Caching Headers
**Issue:** Static assets not cached
**Fix:** Configure in `next.config.js`

```javascript
async headers() {
  return [
    {
      source: '/_next/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ];
}
```

---

## Optimization Opportunities

### Immediate Quick Wins
1. ✅ **Enable compression** - Gzip/Brotli for text assets
2. ✅ **Minimize main thread work** - Offload heavy calculations to Web Workers
3. ✅ **Reduce JavaScript execution time** - Code split large bundles
4. ✅ **Eliminate render-blocking resources** - Defer non-critical CSS/JS

### Short-Term Improvements
5. ⚠️ **Implement service worker** - PWA for offline support
6. ⚠️ **Use CDN for static assets** - Reduce latency
7. ⚠️ **Optimize font loading** - Self-host Google Fonts with font-display: swap
8. ⚠️ **Lazy load below-the-fold content** - Intersection Observer API

### Long-Term Enhancements
9. 📊 **Implement performance monitoring** - Real User Monitoring (RUM)
10. 🔄 **Add performance budgets** - Fail builds if budget exceeded
11. 📈 **Track Core Web Vitals** - Google Analytics or Vercel Analytics

---

## Manual Audit Checklist

### Before Running Audit
- [ ] Clear browser cache (Ctrl+Shift+Del)
- [ ] Open in incognito/private window
- [ ] Disable browser extensions
- [ ] Ensure stable network connection
- [ ] Backend API is running

### During Audit
- [ ] Run audit 3 times for each page
- [ ] Take median score (not average)
- [ ] Screenshot full Lighthouse report
- [ ] Note any console errors or warnings

### After Audit
- [ ] Document all scores in spreadsheet
- [ ] Identify performance bottlenecks
- [ ] Prioritize fixes (high impact, low effort first)
- [ ] Re-audit after optimizations

---

## Report Template

Use this template to document Lighthouse audit results:

```markdown
# Lighthouse Audit Results

## Showroom Page
**URL:** http://localhost:3006/portal/showroom
**Date:** [Date]
**Device:** Desktop

| Metric | Score | Status |
|--------|-------|--------|
| Performance | XX / 100 | ✅ / ⚠️ / ❌ |
| Accessibility | XX / 100 | ✅ / ⚠️ / ❌ |
| Best Practices | XX / 100 | ✅ / ⚠️ / ❌ |
| SEO | XX / 100 | ✅ / ⚠️ / ❌ |

### Core Web Vitals
- **FCP:** X.Xs
- **LCP:** X.Xs
- **TBT:** XXms
- **CLS:** 0.XX
- **Speed Index:** X.Xs

### Issues Found
1. [Issue description]
   - Impact: High/Medium/Low
   - Recommendation: [How to fix]

## Dashboard Page
[Same template]

## Products Page
[Same template]

## Summary
- **Overall Status:** ✅ Ready / ⚠️ Needs work / ❌ Blocked
- **Critical Issues:** X
- **Warnings:** X
- **Total Recommendations:** X

## Next Steps
1. [Prioritized action item]
2. [Prioritized action item]
3. [Prioritized action item]
```

---

## Acceptance Criteria

Before marking Lighthouse audit as complete:

✅ All three pages audited
✅ Performance scores documented
✅ Accessibility issues identified
✅ Critical issues flagged for fixing
✅ Optimization recommendations provided
✅ Re-audit scheduled after fixes

---

## Tools & Resources

### Lighthouse Resources
- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/)
- [Web Vitals](https://web.dev/vitals/)
- [PageSpeed Insights](https://pagespeed.web.dev/)

### Performance Optimization
- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [WebPageTest](https://www.webpagetest.org/)

### Monitoring
- [Vercel Analytics](https://vercel.com/analytics)
- [Google Analytics 4](https://analytics.google.com/)
- [Sentry Performance Monitoring](https://sentry.io/for/performance/)

---

**Last Updated:** 2026-01-17
**Maintainer:** Development Team
