# IICRC Brisbane — Research & Content Plan

**Scope**: Content and marketing plan for IICRC training courses delivered by CCW Online in Brisbane.
**Goal**: Establish CCW Online as the go-to IICRC training provider in South East Queensland.

---

## Market Research Summary

### Target Audience Analysis

**Primary Audience**: Carpet cleaning operators in Greater Brisbane (0–5 years experience)

- Typically sole operators or small teams (1–3 people)
- Annual revenue: $60k–$250k
- Pain points: Standing out from low-cost competitors, accessing commercial contracts
- Motivation for certification: Professionalism, commercial contract access, skill validation

**Secondary Audience**: Restoration and water damage contractors

- Want WRT certification but CCT is a natural entry point
- Often referred by plumbers, strata managers, insurance companies
- Higher ticket jobs, insurance billing

**Tertiary Audience**: In-house cleaning staff (facilities management)

- Hotels, aged care, commercial property
- Want verifiable training records for staff
- Group bookings with invoicing required

---

### Competitive Landscape (SEQ)

| Provider             | Location | IICRC Courses | Price Point | Notes                                                            |
| -------------------- | -------- | ------------- | ----------- | ---------------------------------------------------------------- |
| CCW Online           | Brisbane | CCT, WRT      | Competitive | Equipment supplier advantage — combined purchase/training offers |
| [Competitor 1]       | Sydney   | Multiple      | Higher      | Mainland travel required                                         |
| Online IICRC options | N/A      | Limited       | Lower       | No hands-on component                                            |

**CCW Online Advantage**: Equipment supplier + training provider in one — trainees can purchase equipment alongside certification. Unique in QLD market.

---

## Keyword Research

### Primary Keywords (high intent)

| Keyword                                 | Search Intent            | Target Page               |
| --------------------------------------- | ------------------------ | ------------------------- |
| IICRC CCT Brisbane                      | Commercial intent        | Brisbane CCT landing page |
| carpet cleaning certification Brisbane  | Commercial intent        | Brisbane CCT landing page |
| IICRC training Queensland               | Informational/commercial | Course overview page      |
| IICRC CCT course Australia              | Commercial intent        | National course page      |
| carpet cleaning certification Australia | Commercial intent        | National course page      |
| IICRC authorised provider Brisbane      | Commercial intent        | Provider credibility page |

### Long-tail Keywords

| Keyword                                      | Monthly Volume (est.) | Difficulty |
| -------------------------------------------- | --------------------- | ---------- |
| how to get IICRC certified Australia         | 50–100                | Low        |
| IICRC CCT exam Brisbane                      | 30–50                 | Low        |
| carpet cleaning technician course QLD        | 20–50                 | Low        |
| IICRC training cost Australia                | 50–100                | Medium     |
| best carpet cleaning certification Australia | 30–70                 | Medium     |

---

## Content Plan

### Tier 1: Core Commercial Pages (6–8 weeks)

**Page 1: IICRC Training — Brisbane Hub Page**

- URL: `/iicrc-training/brisbane`
- Content: Overview of all IICRC courses available in Brisbane through CCW Online
- Schema: Course, LocalBusiness, FAQPage
- CTA: Register / Call / Download course guide

**Page 2: IICRC CCT — Brisbane (Course-specific)**

- URL: `/iicrc-training/brisbane/cct`
- Content: Full CCT course detail page (use Brisbane CCT landing page copy)
- Schema: Course, FAQPage
- CTA: Registration form / Phone

**Page 3: IICRC WRT — Brisbane**

- URL: `/iicrc-training/brisbane/wrt`
- Content: Water Restoration Technician course page (mirror structure of CCT page)
- Schema: Course, FAQPage

**Page 4: IICRC Provider Page**

- URL: `/iicrc-authorised-provider`
- Content: CCW Online's status as IICRC authorised training provider, course listing, national dates
- Schema: Organization, Course list
- CTA: Find a course near you

---

### Tier 2: SEO Content Hub (8–12 weeks)

**Article 1**: "IICRC CCT vs WRT: Which Certification Should You Get First?"

- Target: operators deciding on first certification
- Word count: 1,500–2,000 words
- Internal links: CCT page, WRT page, FAQ

**Article 2**: "Is IICRC Certification Worth It for Australian Carpet Cleaners in 2026?"

- Target: operators researching whether to certify
- Word count: 1,500–2,000 words
- Real data points: wage premiums, contract access, insurance requirements

**Article 3**: "How to Pass the IICRC CCT Exam First Time"

- Target: already enrolled or researching the exam
- Word count: 800–1,200 words
- Study tips, exam format, preparation resources

**Article 4**: "What is IICRC Certification? A Guide for Australian Cleaning Professionals"

- Target: top-of-funnel, new to industry
- Word count: 1,000–1,500 words
- Introductory guide to IICRC, certification levels, how to get certified

**Article 5**: "IICRC Certification and Commercial Contracts: What Facilities Managers Look For"

- Target: operators wanting to break into commercial
- Word count: 1,200–1,500 words
- Quote from facilities management perspective (even if hypothetical)

---

### Tier 3: Local SEO Content (ongoing)

**Brisbane suburb targeting pages** (if warranted by search volume):

- "Carpet cleaning training Gold Coast" → redirect or hub page
- "IICRC certification Sunshine Coast" → course availability page
- "Carpet cleaning certification Ipswich" → Brisbane course page with proximity note

**Google Business Profile posts** (weekly during course campaign periods):

- Course announcement posts
- "Spots available" urgency posts
- Post-course testimonial posts
- Educational tips from course content

---

## Schema Implementation Plan

### Course Schema (for each course page)

```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "IICRC Carpet Cleaning Technician (CCT) — Brisbane",
  "description": "2-day IICRC CCT certification course in Brisbane, QLD. Covers carpet fibre science, stain chemistry, HWE technique, and professional problem-solving.",
  "provider": {
    "@type": "Organization",
    "@id": "https://ccwonline.com.au/#organization",
    "name": "CCW Online"
  },
  "educationalLevel": "Beginner to Intermediate",
  "teaches": "Carpet cleaning technique, fibre identification, stain chemistry, IICRC standards",
  "location": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Brisbane",
      "addressRegion": "QLD",
      "addressCountry": "AU"
    }
  },
  "inLanguage": "en-AU",
  "availableLanguage": "English",
  "courseMode": "in-person",
  "duration": "P2D",
  "hasCourseInstance": {
    "@type": "CourseInstance",
    "courseMode": "in-person",
    "location": "Brisbane, QLD",
    "instructor": {
      "@type": "Person",
      "name": "[Instructor name — confirm with CCW team]"
    }
  }
}
```

---

## Campaign Calendar (Ongoing Brisbane)

| Month        | Campaign Focus               | Content Deliverable                  |
| ------------ | ---------------------------- | ------------------------------------ |
| March 2026   | Brisbane CCT (April course)  | Landing page live + 3-email sequence |
| April 2026   | Post-course testimonials     | Social proof content                 |
| May 2026     | IICRC hub page launch        | SEO content articles 1–2             |
| June 2026    | WRT course promotion         | WRT landing page                     |
| July 2026    | Winter restoration season    | Water damage content                 |
| Aug–Sep 2026 | Q3 Brisbane CCT              | Repeat email sequence                |
| Oct 2026     | Pre-summer deep clean season | Equipment + chemical push            |
| Nov–Dec 2026 | Q4 Brisbane CCT              | Year-end campaign                    |

---

## Success Metrics

| Metric                            | Baseline | 6-Month Target |
| --------------------------------- | -------- | -------------- |
| Organic visits to IICRC pages     | 0        | 500/month      |
| Course registrations from organic | 0        | 3–5/month      |
| IICRC keyword rankings (top 10)   | 0        | 8–12 keywords  |
| GBP course post reach             | N/A      | 200+ per post  |
| Email open rate (IICRC sequence)  | —        | >30%           |
| Email click rate (IICRC sequence) | —        | >5%            |

---

## Next Actions

1. [ ] Confirm Brisbane CCT course dates and venue for 2026
2. [ ] Confirm Launceston CCT venue
3. [ ] Set up `/iicrc-training/` URL structure on ccwonline.com.au
4. [ ] Implement Course schema on training pages
5. [ ] Launch 3-email sequence for Brisbane CCT
6. [ ] Create and schedule social media posts per calendar
7. [ ] Add IICRC pages to XML sitemap
8. [ ] Set up Google Analytics goals for course registration conversions
9. [ ] Create Google Business Profile posts for course promotion
10. [ ] Review and publish SEO content articles (Tier 2)
