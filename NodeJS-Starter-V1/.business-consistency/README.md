# Business Consistency Framework

Achieve complete NAP consistency across all platforms for maximum local search visibility.

## Why This Matters

- **40% more likely** to appear in local pack with consistent NAP
- **32% of local pack ranking** comes from Google Business Profile signals
- **AI systems** (ChatGPT, Perplexity, Gemini) pull from multiple sources
- **One variation** can split your citation equity

## Quick Start

```bash
# 1. Create your master business document
cp _templates/business-profile.template.yaml master-document/my-business.yaml
# Fill in ALL fields - this is your single source of truth

# 2. Audit current listings
# Follow audit/checklist.yaml

# 3. Update platform listings
# Use master document as reference for ALL updates
```

## The Consistency Tiers

| Tier | Elements | Rule |
|------|----------|------|
| 1 Critical | Name, Address, Phone | EXACTLY identical everywhere |
| 2 Essential | URL, Email, Hours, Category | Consistent format |
| 3 Important | Description, Service Areas, Social | Align messaging |
| 4 Australia | ABN, ACN, Licenses | Include where required |

## Platform Priority

| Tier | Platforms | Action |
|------|-----------|--------|
| 1 | GBP, Bing, Apple Maps, Facebook | MANDATORY - Do first |
| 2 | Yellow Pages, True Local, Yelp | HIGH - Australia focus |
| 3 | LinkedIn, Instagram, YouTube | MEDIUM - Social presence |
| 4 | StartLocal, dLook, WOMO | BUILD OUT - Citations |
| 5 | Oneflare, hipages | INDUSTRY - If applicable |

## Common Mistakes to Avoid

| Mistake | Impact | Fix |
|---------|--------|-----|
| Adding keywords to name | Suspension risk | Legal name only |
| Different phone formats | Split citations | One format everywhere |
| St vs Street | Different entities | Pick one, stick to it |
| Missing Pty Ltd | Inconsistency | Include or exclude consistently |

## Schema Markup

Every website needs LocalBusiness JSON-LD schema with:
- **Required:** @type, name, address, telephone, url
- **Recommended:** geo, openingHours, sameAs, areaServed

## GEO (AI Search) Optimization

- Schema helps AI understand your business
- Consistent data across sources = better AI recognition
- Voice assistants rely on citation data
- Traditional search declining - AI search rising

## Audit Schedule

| Frequency | Task |
|-----------|------|
| Weekly | Check GBP for suggested edits |
| Monthly | Spot-check top 10 citations |
| Quarterly | Full consistency audit |

## File Structure

```
.business-consistency/
├── nap/              # Consistency rules and formats
├── platforms/        # Platform-specific guides
├── schema/           # JSON-LD markup
├── geo/              # AI search optimization
├── audit/            # Checklists and metrics
├── master-document/  # Single source of truth
├── implementation/   # Step-by-step guides
└── _templates/       # Starter templates
```

## Integration

- **Copywriting**: NAP appears correctly in all copy
- **Visual Content**: Same logo/imagery everywhere
- **Foundation-First**: Supports journey consistency
