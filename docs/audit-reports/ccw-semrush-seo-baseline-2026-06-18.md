# CCW Semrush SEO Baseline Audit

Date: 2026-06-18 10:50 AEST  
Site audited: `https://ccwonline.com.au`  
Semrush project: `Carpet Cleaners Warehouse`  
Purpose: establish the before-repair baseline Toby can compare against after remediation and a fresh Semrush crawl.

## Executive Summary

CCW is crawlable and already exposes modern Shopify agent surfaces, but Semrush currently scores the project at **86% Site Health** and **75% AI Search Health**. The most important blockers are not keyword tweaks; they are Shopify/theme crawl weight, sitemap/internal-link quality, structured data, and crawl freshness.

The Semrush Site Audit snapshot for CCW is stale: it was last updated on **2026-02-03**, while live checks on **2026-06-18** show `/llms.txt`, `/agents.md`, and `/.well-known/ucp` all return `200`. So the first repair loop should fix visible issues, then rerun the Semrush campaign before presenting final progress.

## Evidence Sources

- Semrush UI via signed-in Chrome session, project `Carpet Cleaners Warehouse`.
- Live HTTP checks against `https://ccwonline.com.au`.
- Live sitemap crawl of `https://ccwonline.com.au/sitemap.xml`.
- Sample page fetches across home, collection, product, page, and blog surfaces.

## Semrush Baseline

### Site Audit

From Semrush Site Audit for `ccwonline.com.au`:

| Metric | Current Semrush Value |
| --- | ---: |
| Site Health | 86% |
| Top 10% benchmark | 92% |
| AI Search Health | 75% |
| AI Search target hint | Reach 80% |
| Pages crawled | 214 / 500 |
| Healthy pages | 2 |
| Broken pages | 1 |
| Pages with issues | 201 |
| Redirect pages | 1 |
| Blocked pages | 9 |
| Errors | 197 |
| Warnings | 9 |
| Semrush audit updated | 2026-02-03 |

### Issue Inventory

| Severity | Semrush issue | Count | Repair priority |
| --- | --- | ---: | --- |
| Error | Pages have too large HTML size | 196 pages | P0 |
| Error | Structured data item is invalid | 1 item | P0 |
| Warning | Images missing alt attributes | 3 images | P2 |
| Warning | Unminified JavaScript and CSS files | 3 issues | P1 |
| Warning | Title tag too long | 1 page | P2 |
| Warning | Low text-to-HTML ratio | 1 page | P1 |
| Warning | Blocked internal resource in robots.txt | 1 issue | P1 |
| Notice | Orphaned pages in sitemaps | 2,690 pages | P0 |
| Notice | Pages have only one incoming internal link | 197 pages | P0 |
| Notice | Pages contain too much content for AI Search | 196 pages | P0 |
| Notice | Pages blocked from crawling | 9 pages | P1 |
| Notice | `llms.txt` not found | 1 page | Recheck |
| Notice | Blocked external resource in robots.txt | 1 issue | P2 |

## Ranking And Visibility Baseline

### Position Tracking

Semrush Position Tracking is configured for **Australia (Google) - English** and was updated about 21 hours before the audit.

| Metric | Value |
| --- | ---: |
| Visibility | 0% |
| Top 3 tracked keywords | 0 |
| Top 10 tracked keywords | 0 |
| Top 20 tracked keywords | 0 |
| Top 100 tracked keywords | 0 |

Visible tracked keywords are too broad for CCW's strongest commercial intent:

- `cleaning product supplier`
- `equipment supplier`
- `machine maintenance service`
- `manufacturer`
- `repair services`

These should be replaced or expanded with specific commercial and local-intent terms such as carpet cleaning equipment, carpet cleaning chemicals, restoration equipment, truckmount servicing, upholstery cleaning chemicals, tile cleaning products, and CCW branch/location terms.

### AI Search

Semrush AI Search widget for Australia:

| Metric | Value |
| --- | ---: |
| AI Visibility | 15 |
| Mentions | 33 |
| Cited pages | 80 |
| ChatGPT mentions | 4 |
| Google AI Overview mentions | 10 |
| Google AI Mode mentions | 4 |
| Gemini mentions | 15 |

This is a stronger starting point than Position Tracking, but the AI Search Health audit still flags crawl/content issues.

## Live Site Verification

### Agent And AI Discovery

Live checks on 2026-06-18:

| URL | Status | Notes |
| --- | ---: | --- |
| `https://ccwonline.com.au/robots.txt` | 200 | Public Shopify surfaces allowed; private/transactional paths blocked. |
| `https://ccwonline.com.au/sitemap.xml` | 200 | Shopify sitemap index available. |
| `https://ccwonline.com.au/llms.txt` | 200 | Semrush's stale "not found" notice should clear after rerun. |
| `https://ccwonline.com.au/agents.md` | 200 | Agent instructions available. |
| `https://ccwonline.com.au/.well-known/ucp` | 200 | UCP discovery endpoint available. |

Live `robots.txt` also advertises:

- `https://ccwonline.com.au/agents.md`
- `https://ccwonline.com.au/.well-known/ucp`
- `https://ccwonline.com.au/api/ucp/mcp`

### Sitemap Counts

Live sitemap crawl:

| Sitemap | URLs |
| --- | ---: |
| `sitemap_agentic_discovery.xml` | 1 |
| `sitemap_products_1.xml` | 2,501 |
| `sitemap_pages_1.xml` | 11 |
| `sitemap_collections_1.xml` | 295 |
| `sitemap_blogs_1.xml` | 97 |
| Total sitemap entries | 2,905 |
| Unique URLs | 1,656 |

URL type count:

| Type | Count |
| --- | ---: |
| Product | 2,500 |
| Collection | 295 |
| Blog | 97 |
| Page | 11 |
| Other | 2 |

The gap between 2,905 entries and 1,656 unique URLs needs review. It may be normal Shopify duplication in generated sitemaps, but it aligns with Semrush's orphaned-page and weak-internal-link findings.

### Sample Page Findings

Several sampled HTML pages exceeded the first 1 MB fetched, including home, collection, product, page, and blog surfaces. This supports Semrush's "large HTML page size" and "too much content" findings.

Sample observations:

| Page type | Example | Finding |
| --- | --- | --- |
| Home | `/` | Title length 88; first 1 MB fetched; 55 image tags; 4 missing alt attributes in first MB. |
| Collection | `/collections/frontpage` | First 1 MB fetched; no meta description detected in first MB; 4 missing alt attributes. |
| Product | `/products/flex-traffic-lane-clnr-3-78ltr` | First 1 MB fetched; meta description length 304; 6 missing alt attributes. |
| Page | `/pages/wish-list` | First 1 MB fetched; no meta description detected; 4 missing alt attributes. |
| Blog index | `/blogs/news` | First 1 MB fetched; no meta description detected; 4 missing alt attributes. |

No `application/ld+json` blocks were detected in the first 1 MB of sampled HTML. The invalid structured data issue should be inspected in Semrush and Google Rich Results after the current crawl is rerun, because Shopify themes can emit structured data after the sampled slice or through app/theme snippets.

## Highest-Impact Repair Queue

### P0 - Score And Crawl Health

1. **Rerun Semrush Site Audit after recording this baseline.**  
   The audit is stale and already disagrees with live `/llms.txt` and `/agents.md`.

2. **Reduce Shopify theme/page HTML weight.**  
   Target the 196 pages over Semrush's HTML-size threshold and the 196 pages flagged for AI "too much content".

3. **Resolve sitemap orphan/internal-link structure.**  
   Prioritize pages in sitemaps with one or zero internal links, especially products and collections that should rank or convert.

4. **Fix invalid structured data.**  
   Inspect the exact Semrush issue detail and Google Rich Results output after rerun. Ensure Product, Organization, Breadcrumb, and LocalBusiness schema are valid and not duplicated/conflicting.

### P1 - AI Search And Crawlability

5. **Confirm `llms.txt` clears in Semrush.**  
   Live site returns `200`, so this should be marked fixed after rerun.

6. **Review blocked pages/resources.**  
   Shopify correctly blocks private/transactional routes. Only fix blocked resources if the blocked resource is required for rendering crawlable content.

7. **Add or tune internal links between equipment, service, chemicals, and training pathways.**  
   This directly addresses weak internal linking and supports CCW/CARSI ecosystem discovery without mixing ownership of the two sites.

### P2 - Content Quality

8. **Fix missing image alt text on key templates.**
9. **Shorten the one overlong title tag.**
10. **Add/repair meta descriptions on thin Shopify page, collection, and blog templates.**
11. **Review unminified JS/CSS warnings, but only after theme/app bloat is understood.**

## Keyword Tracking Fix

The current tracked keyword set is too broad. Add a practical Australian keyword set grouped by purchase intent:

| Cluster | Example keywords |
| --- | --- |
| Equipment | carpet cleaning equipment, carpet cleaning machine, truckmount carpet cleaner, portable carpet cleaner |
| Chemicals | carpet cleaning chemicals, upholstery cleaning chemicals, stain removal chemicals, tile cleaning chemicals |
| Service | carpet cleaning machine service, truckmount servicing, carpet extractor repair, carpet cleaning equipment repairs |
| Business growth | start a carpet cleaning business, carpet cleaning business equipment, carpet cleaning training Australia |
| Local/brand | carpet cleaners warehouse, CCW carpet cleaners warehouse, carpet cleaning supplies Brisbane, carpet cleaning supplies Sydney, carpet cleaning supplies Melbourne |

## Toby-Facing Before/After Metrics

Use this scorecard for the repair presentation.

| Metric | Baseline | After repairs |
| --- | ---: | ---: |
| Site Health | 86% | TBD |
| AI Search Health | 75% | TBD |
| Errors | 197 | TBD |
| Warnings | 9 | TBD |
| Pages with large HTML | 196 | TBD |
| Pages with too much AI-search content | 196 | TBD |
| Orphaned pages in sitemaps | 2,690 | TBD |
| Pages with only one internal link | 197 | TBD |
| Position Tracking visibility | 0% | TBD |
| Tracked keywords in Top 10 | 0 | TBD |
| AI Visibility Australia | 15 | TBD |
| AI mentions Australia | 33 | TBD |
| AI cited pages Australia | 80 | TBD |

## Recommended Next Step

Run repairs in this order:

1. Rerun Semrush crawl or record the current stale Semrush baseline as the "before" state.
2. Fix theme/page bloat and template-level HTML weight.
3. Fix internal-link architecture and sitemap orphan issues.
4. Validate structured data.
5. Replace broad tracked keywords with CCW-specific Australian commercial terms.
6. Rerun Semrush and complete the "After repairs" column.

