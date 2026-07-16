# Production-Readiness Spec - Search, AI Citation, And Audience Growth Loop

**Date:** 18 June 2026
**Project:** CCW-CRM search ecosystem
**Businesses:** CARSI, Carpet Cleaners Warehouse, Disaster Recovery, NRPG, RestoreAssist
**Owner audience:** Toby
**Repo:** `CleanExpo/CCW-CRM`
**Branch target:** `main`
**Status target:** 100% green, deployed, submitted for crawl, and pushed to `main`

## Finish Line

This phase is done only when the priority moves from the June 2026 Google/Bing/LLM search review are implemented in a repeatable loop until every P0/P1 gate is green, the relevant production sites are updated, Google Search Console and Bing Webmaster surfaces are refreshed, AI/search crawler rules are intentional, and the repo work is pushed to `main`.

The required businesses are:

- CARSI: `https://www.carsi.com.au`
- CCW: `https://www.ccwarehouse.com.au`
- Disaster Recovery: `https://www.disasterrecovery.com.au`
- NRPG: `https://www.nrpg.business`
- RestoreAssist: `https://restoreassist.app`

## Evidence Ledger

- [VERIFIED] Google's June 2026 guidance says generative AI search visibility still depends on foundational Search quality systems, indexing, snippets, crawlability, technical structure, unique helpful content, and non-commodity expertise. Source: Google Search Central, "Optimizing your website for generative AI features on Google Search."
- [VERIFIED] Google AI features use query fan-out, where a single prompt can trigger multiple related searches and supporting source retrieval. Source: Google Search Central, "AI features and your website."
- [VERIFIED] Google says not to chase special AI hacks such as mandatory `llms.txt`, special AI markup, artificial chunking, rewriting only for AI systems, or inauthentic mentions. Source: Google Search Central, "Optimizing your website for generative AI features on Google Search."
- [VERIFIED] Google says local business and ecommerce details can matter in AI responses and recommends Google Business Profile, Merchant Center, and emerging Business Agent experiences where relevant. Source: Google Search Central, "Optimizing your website for generative AI features on Google Search."
- [VERIFIED] Bing Webmaster Tools launched AI Performance reporting in public preview, showing citations, cited pages, grounding queries, and AI visibility trends across Copilot/Bing AI surfaces. Source: Bing Webmaster Blog, February 2026.
- [VERIFIED] OpenAI documents `OAI-SearchBot` as the crawler for surfacing sites in ChatGPT search answers, separate from training-oriented crawling. Source: OpenAI crawler documentation.
- [VERIFIED] Perplexity documents crawler/user-agent controls that can be managed through `robots.txt`. Source: Perplexity crawler documentation.
- [VERIFIED] Live checks on 18 June 2026 showed CARSI responds, has a sitemap, and currently allows broad AI crawler access.
- [VERIFIED] Live checks on 18 June 2026 showed Disaster Recovery responds, has a sitemap, and currently includes some utility/payment/error-style URLs in the sitemap.
- [VERIFIED] Live checks on 18 June 2026 showed RestoreAssist responds and has a sitemap, but indexed public surfaces include placeholder or "Coming Soon" style content.
- [VERIFIED] Live checks on 18 June 2026 showed `https://www.nrpg.business` returns Vercel `DEPLOYMENT_NOT_FOUND`.
- [VERIFIED] Live checks on 18 June 2026 showed `https://www.ccwarehouse.com.au` timed out repeatedly from the execution environment and requires a separate external crawlability/indexability check.
- [INFERENCE] The strongest audience-growth opportunity is to make CCW and CARSI the cited source for "start a carpet cleaning business", equipment, chemicals, service, training, and business-growth queries, then route high-intent demand into CARSI courses and CCW product/service pathways.

## 0. Where This Sits In The Pipeline

This spec turns the search research into an implementation loop:

1. **Discover:** verify each domain, Search Console/Bing status, sitemap, robots, schema, page quality, GA4 activity, and AI citation availability.
2. **Fix:** repair technical blockers, indexability issues, crawler rules, sitemap pollution, placeholder content, missing schema, and weak entity links.
3. **Publish:** deploy production updates and push the repo work to `main`.
4. **Submit:** request crawl/indexing in Google Search Console, submit/update sitemaps, use Bing Webmaster Tools and IndexNow.
5. **Measure:** check GA4, GSC, Bing Webmaster Tools, Bing AI Performance, and manual AI-search prompts.
6. **Loop:** repeat until every required gate is green or explicitly owner-deferred with a reason, date, and owner.

No phase is complete because code exists locally. A phase is complete only when the public site, webmaster tools, analytics, and repo state agree.

## 1. System Observatory

### Business Entity Map

The ecosystem needs to be understandable to humans and machines:

- **CCW** supplies professional carpet cleaning, restoration, equipment, chemicals, servicing, product advice, and customer support.
- **CARSI** trains operators and businesses in carpet cleaning, restoration, chemistry, machinery, safety, business growth, and IICRC-aligned continuing education.
- **Disaster Recovery** captures emergency restoration demand and proves industry authority through IICRC, S500/S520, claims documentation, and national response pathways.
- **NRPG** should be the restoration contractor network and authority layer, but the current public domain is unavailable.
- **RestoreAssist** provides restoration CRM/reporting software for evidence-based field capture, compliance, reporting, billing, and operational confidence.

The public web graph must make those relationships explicit through entity pages, schema, internal links, author/about pages, citations, and source-backed pages.

### Current Priority Moves

These are mandatory P0/P1 moves from the June 2026 review:

1. Fix `nrpg.business` immediately.
2. Audit CCW crawlability, Shopify sitemap, robots, speed, product schema, collection schema, local/business details, and index coverage.
3. Clean Disaster Recovery sitemap so only useful public pages are submitted.
4. Replace RestoreAssist "Coming Soon" pages with real helpful content, or apply `noindex` until ready.
5. Add or verify Bing Webmaster AI Performance monitoring and IndexNow across all sites.
6. Tighten robots strategy: deliberately allow search/citation crawlers and decide separately whether training crawlers are allowed.
7. Build a 90-day content cluster around "start a carpet cleaning business" that links CARSI courses to CCW starter equipment, chemicals, servicing, and support.

### Measurement Surfaces

The loop must collect evidence from:

- Google Search Console: domain verification, sitemap status, indexing, URL inspection, enhancements, manual actions, performance.
- Bing Webmaster Tools: domain verification, sitemap status, URL inspection, IndexNow, SEO reports, AI Performance.
- GA4: active data collection, organic search traffic, conversions, campaign paths, event quality.
- Public crawl checks: HTTP status, robots, sitemap, canonical, title/meta, schema, page speed/Core Web Vitals where practical.
- AI search checks: ChatGPT Search, Bing Copilot, Perplexity, Google AI Overviews/AI Mode where visible.
- Repo checks: lint, type-check, tests, build, deploy status, branch/main push state.

## 2. Definition Of 100% Green

The work is 100% green only when all of the following are true.

### Domain And Crawlability

- Every target domain returns a production `200` for the intended public home page.
- `www` and apex domain behavior is intentional and canonicalized.
- `robots.txt` is reachable, current, and not blocking required public content.
- XML sitemap is reachable and submitted.
- Sitemaps include only index-worthy public pages.
- Utility, admin, error, checkout, payment-success, auth, dashboard, API, and placeholder pages are excluded or noindexed.
- Canonicals are correct on important public pages.

### Search Console And Bing

- Google Search Console property is verified for each domain or owner-approved as not applicable.
- Bing Webmaster Tools property is verified for each domain or owner-approved as not applicable.
- Current sitemap is submitted in both tools.
- Bing IndexNow is implemented or manually available for changed URLs.
- URL inspection for the priority pages is green or has a documented remediation item.
- Bing AI Performance baseline exists for each eligible domain, even if the initial count is zero.

### AI And Crawler Strategy

- `OAI-SearchBot`, `ChatGPT-User`, `Bingbot`, `Googlebot`, and `PerplexityBot` handling is intentional and documented.
- Training crawlers such as `GPTBot`, `Google-Extended`, `CCBot`, and similar are explicitly allowed or disallowed by owner decision, not accidentally copied.
- If `llms.txt` is used, it is documented as an optional non-Google helper and not treated as a Google ranking requirement.

### Content Quality

- CARSI and CCW have a linked content cluster for "start a carpet cleaning business" with training, business setup, equipment, chemicals, machinery, safety, servicing, and first purchase guidance.
- Pages answer specific user questions, not just generic service claims.
- Important claims have evidence, dates, author/reviewer details, and source links where needed.
- Placeholder "Coming Soon" content is removed, completed, or noindexed.
- Each business has an entity/about page that explains its role in the broader ecosystem.
- Internal links connect CARSI, CCW, Disaster Recovery, NRPG, and RestoreAssist where truthful and useful.

### Structured Data And Commerce

- CCW product and collection pages expose valid product data, price/availability where possible, brand, category, images, and merchant-ready details.
- CARSI course pages expose course/training information in a clear, crawlable structure.
- Disaster Recovery service/location pages expose local/service information without sitemap noise.
- RestoreAssist SaaS pages expose software, pricing, FAQ/help, and organization details.
- Schema validation has no blocking errors on priority pages.

### Analytics And Conversion

- GA4 is active for CARSI, Disaster Recovery, NRPG if applicable, RestoreAssist, and CCW if within scope/access.
- Organic search, course signup, product clicks, quote enquiries, service bookings, lead submissions, free trials, and phone/contact actions are measurable.
- Conversion events are named consistently enough to compare audience capture across the ecosystem.

### Repo And Release

- All changes are committed.
- CI or local equivalents pass: `npm run lint`, `npm run type-check`, `npm run test`, and `npm run build` where applicable.
- Production deployments are successful for every changed site.
- The final branch is pushed to `main`.
- The final report lists URLs submitted, checks passed, unresolved amber items, and exact evidence.

## 3. Gap-Discovery Mechanism

Every loop starts with a mechanical gap table. Each item must be red, amber, or green.

| Severity | Gap                     | Red Condition                                                                             | Green Condition                                                                                   |
| -------- | ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| P0       | NRPG domain             | `nrpg.business` returns deployment error, 4xx, 5xx, or wrong app.                         | Intended public NRPG page returns `200`, canonical and sitemap are valid.                         |
| P0       | CCW crawlability        | CCW times out, blocks crawlers, lacks sitemap access, or product pages cannot be fetched. | CCW home, key collections, and key product pages fetch successfully and expose indexable content. |
| P0       | Webmaster verification  | Domain is not verified in GSC/Bing and cannot submit sitemaps.                            | Domain is verified or owner-approved as out of current scope.                                     |
| P0       | Production deployment   | Local changes are not live.                                                               | Production deployment is confirmed and checked.                                                   |
| P1       | Sitemap pollution       | Utility/error/payment/auth/admin/placeholder pages are submitted.                         | Sitemap contains only useful public pages.                                                        |
| P1       | Robots ambiguity        | Search/citation and training crawlers are not intentionally separated.                    | Robots policy is documented and applied by domain.                                                |
| P1       | Placeholder content     | "Coming Soon" or thin pages are indexable.                                                | Pages are completed, removed from sitemap, or noindexed.                                          |
| P1       | AI citation measurement | Bing AI Performance is not checked.                                                       | Baseline citation/grounding-query data is recorded.                                               |
| P1       | IndexNow                | Changed URLs are not submitted to Bing/IndexNow.                                          | Changed URLs are submitted or queued through IndexNow.                                            |
| P1       | Entity graph            | Business relationships are unclear or unsupported.                                        | Each business has a clear role page and cross-links to the others where useful.                   |
| P1       | Content cluster         | No 90-day topical plan exists for high-intent carpet cleaning startup queries.            | Cluster has shipped pages, internal links, conversion CTAs, and measurement.                      |
| P1       | Schema                  | Priority pages lack useful valid schema.                                                  | Priority pages validate without blocking errors.                                                  |
| P2       | Reporting               | No owner-readable status report exists.                                                   | Final report shows checks, screenshots/exports where possible, and next review date.              |

## 4. Consequential-Action Gates

Standing rule: the system may prepare search, citation, and marketing actions, but may not commit risky external changes until a human or hard rule clears the gate.

| Domain               | System May Prepare                                                 | It Must Not Commit Without Gate                                                                                         | Gate                                         |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Domain fixes         | Diagnose DNS, Vercel, Shopify, redirects, and canonical issues.    | Change DNS, delete domains, or redirect production domains blindly.                                                     | Owner/developer approval plus rollback note. |
| Search Console/Bing  | Submit verified sitemaps and URL inspections for approved domains. | Claim new ownership methods or modify DNS verification without approval.                                                | Existing verified access or owner approval.  |
| Robots/crawlers      | Draft search/citation/training crawler policy.                     | Allow training crawlers for proprietary content by accident.                                                            | Toby/owner decision recorded.                |
| Content claims       | Draft pages, FAQs, comparison tables, and guides.                  | Publish unsupported claims, fake credentials, fake testimonials, fake reviews, or unverified partner claims.            | Evidence tag and reviewer approval.          |
| Commerce claims      | Draft CCW product/course/service recommendations.                  | Promise pricing, stock, chemical suitability, safety outcome, warranty, or training accreditation not backed by source. | CCW/CARSI owner review.                      |
| Legal/privacy/safety | Draft safer wording and disclaimers.                               | Give hazardous chemical, restoration, mould, insurance, health, or legal advice beyond approved source material.        | Source-backed wording and human review.      |
| AI citation outreach | Build citation/community targets.                                  | Spam forums, fake mentions, or inauthentic backlink/mention schemes.                                                    | Manual outreach plan and brand approval.     |
| Deployment           | Prepare PR/main update and deploy checklist.                       | Deploy unrelated dirty work from other repos.                                                                           | Clean diff or explicit release approval.     |

## 5. Phases With Completion Criteria

### Phase 0 - Baseline Audit

**Definition of Done:** each domain has a current audit record for HTTP status, redirects, robots, sitemap, canonical, priority page fetches, schema, GSC, Bing, GA4, and AI search visibility.

**Hard Test Gate:** produce an audit table with every P0/P1 item marked red, amber, or green.

**Review Gate:** Senior PM confirms the findings are evidence-backed and no domain is skipped silently.

### Phase 1 - NRPG Public Domain Repair

**Definition of Done:** `https://www.nrpg.business` and intended canonical NRPG URLs point to the correct production app or a deliberate landing page.

**Hard Test Gate:** home page returns `200`, robots returns `200`, sitemap returns `200`, canonical is correct, and Search Console/Bing can fetch it.

**Review Gate:** Toby confirms whether NRPG is a standalone brand, a Disaster Recovery network sub-brand, or a redirect/canonical relationship.

### Phase 2 - CCW Technical And Commerce Crawl Audit

**Definition of Done:** CCW crawlability, Shopify sitemap, robots, product schema, collection schema, speed, Merchant Center readiness, local/business details, and index coverage are checked.

**Hard Test Gate:** at least home, top collections, top product pages, contact/location pages, and training/CCW-CARSI bridge pages fetch successfully and have indexable content.

**Review Gate:** CCW owner confirms product/category priority list and any restricted pages.

### Phase 3 - Sitemap And Noindex Cleanup

**Definition of Done:** Disaster Recovery and RestoreAssist sitemaps contain only useful public pages; placeholders are completed or noindexed; utility/payment/error/auth/admin pages are excluded.

**Hard Test Gate:** regenerated sitemap contains zero known blocked patterns: `/api`, `/admin`, `/dashboard`, `/login`, `/signup` unless intentionally indexable, `/payment`, `/success`, `/error`, `/coming-soon`, `/test`, `/demo`, `/preview`.

**Review Gate:** Lens review confirms no customer, claim, auth, payment, or private workflow pages are exposed.

### Phase 4 - AI/Robots Policy

**Definition of Done:** each site has an intentional crawler policy separating search/citation crawlers from training crawlers.

**Hard Test Gate:** `robots.txt` matches the approved policy and still exposes public pages and sitemap.

**Review Gate:** Toby decides whether training crawlers are allowed for CARSI, CCW, Disaster Recovery, NRPG, and RestoreAssist.

### Phase 5 - Webmaster Tools And IndexNow

**Definition of Done:** GSC and Bing Webmaster Tools are verified or explicitly owner-deferred for each domain; current sitemaps are submitted; IndexNow is implemented or manually triggered for changed URLs; Bing AI Performance baseline is recorded.

**Hard Test Gate:** each domain has a row showing GSC verification, Bing verification, sitemap submission state, IndexNow state, and Bing AI Performance baseline.

**Review Gate:** Grid/ops confirms the process can be repeated after future page releases.

### Phase 6 - Entity Graph And Cross-Business Authority

**Definition of Done:** public pages explain the ecosystem relationship between CCW, CARSI, Disaster Recovery, NRPG, and RestoreAssist without overstating claims.

**Hard Test Gate:** each business has an entity/about page or section that links to the relevant other businesses, with source-backed wording and clean CTAs.

**Review Gate:** Lens confirms claims are truthful, useful, and not misleading.

### Phase 7 - 90-Day CARSI/CCW Content Cluster

**Definition of Done:** ship a 90-day content cluster around "start a carpet cleaning business" and adjacent buyer-intent paths.

**Minimum Cluster:**

- Start a carpet cleaning business in Australia.
- Carpet cleaning training before buying equipment.
- Beginner carpet cleaning equipment checklist.
- Carpet cleaning chemicals explained.
- Portable extractor vs truckmount.
- First 30 days of a carpet cleaning business.
- How to price carpet cleaning jobs.
- Safety, PPE, SDS, and chemical handling basics.
- When to add tile cleaning, stain removal, rug cleaning, upholstery, or restoration.
- CARSI course pathway for new operators.
- CCW starter bundles and service/support pathway.

**Hard Test Gate:** each page has a clear answer, first-hand or expert insight, internal links to CARSI and CCW conversion paths, author/reviewer details, schema where relevant, and GA4 events.

**Review Gate:** Toby or CCW/CARSI owner confirms commercial accuracy and product/training recommendations.

### Phase 8 - Measurement And Conversion Loop

**Definition of Done:** organic and AI-search visitors can be measured through GA4, GSC, Bing, and conversion events.

**Hard Test Gate:** dashboards or exports show baseline impressions/clicks/sessions, course signup/product/service/free-trial events, and the first review date.

**Review Gate:** Vex/data confirms metrics are decision-useful and not vanity-only.

### Phase 9 - Final Green Release

**Definition of Done:** all red/P0/P1 items are green or owner-approved amber; all changed repos/sites pass checks; production is updated; changed URLs are submitted; final report is committed; CCW-CRM spec is pushed to `main`.

**Hard Test Gate:** local/CI checks pass, production URLs pass fetch checks, and `git status --short` is clean after commit/push.

**Review Gate:** Senior PM signs off that the phase has no hidden "next best task" remaining for this scope.

## 6. Review Layer

A phase passes only when:

1. the hard gate passes;
2. no soft reviewer objects;
3. red P0/P1 items are closed;
4. amber items have an owner, reason, and review date;
5. the final state is visible in the status report.

Suggested reviewers:

- **Senior PM:** completeness, owner clarity, and phase logic.
- **Forge/developer:** implementation, deployment, CI, and rollback safety.
- **Lens/legal-ethics:** claims, safety, privacy, training/accreditation, chemical/insurance wording.
- **Vex/data:** GA4, GSC, Bing, AI Performance, conversion measurement.
- **Grid/ops:** repeatable submission and monitoring process.

## 7. Final Sign-Off Checklist

Use this as the only honest basis for saying the phase is "100% complete."

- [ ] NRPG public domain returns `200` and has valid robots/sitemap/canonical.
- [ ] CCW crawlability and Shopify SEO audit is complete.
- [ ] Disaster Recovery sitemap is clean.
- [ ] RestoreAssist placeholder pages are completed or noindexed.
- [ ] Crawler policy is approved for each site.
- [ ] GSC is verified/submitted for each in-scope domain.
- [ ] Bing Webmaster Tools is verified/submitted for each in-scope domain.
- [ ] Bing AI Performance baseline is recorded.
- [ ] IndexNow is configured or manual submission process is documented.
- [ ] CARSI/CCW 90-day carpet-cleaning startup cluster is published or scheduled with owners.
- [ ] Entity relationship pages/sections are live and truthful.
- [ ] GA4 events measure search-to-lead/course/product/service/free-trial paths.
- [ ] Changed URLs have been submitted for crawl.
- [ ] Lint, type-check, tests, and build pass where applicable.
- [ ] Production deployment is verified.
- [ ] Final report is committed.
- [ ] Changes are pushed to `main`.

## 8. Open Items For Toby To Close

- Decide whether CARSI/CCW/Disaster Recovery/RestoreAssist should allow training crawlers or only search/citation crawlers.
- Confirm whether NRPG should be its own public site, a landing page, or canonicalized into Disaster Recovery.
- Confirm the top CCW product categories and starter bundles to feature in the 90-day content cluster.
- Confirm CARSI course pathway names, course claims, and any accreditation wording limits.
- Confirm which CCW locations, Google Business Profiles, Bing Places listings, and Merchant Center accounts are in scope.
- Confirm whether community/citation building should include forums, associations, supplier pages, LinkedIn, YouTube, podcasts, or trade publication outreach.
- Confirm who approves chemical, equipment, training, restoration, and insurance-related claims before publication.

## Completion Rule

Do not stop after a partial fix. Continue the loop until:

```text
P0 = 0 red
P1 = 0 red
P2 = owner-approved or scheduled
Production = verified
GSC/Bing = submitted
GA4 = active
Bing AI Performance = baseline recorded
Repo = pushed to main
```

If any item cannot be completed because of missing access, owner decision, or third-party failure, mark it amber with a blocker, exact evidence, owner, and review date. Never mark the phase green with an undocumented blocker.
