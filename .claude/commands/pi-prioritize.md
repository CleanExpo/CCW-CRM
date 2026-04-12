# /pi-prioritize — Score Gaps by Impact × Effort → Priority Matrix

Takes gaps from /pi-cross-ref output and scores them for prioritization.

## Scoring Formula

Priority = Impact (1-5) × Effort_Inverse (5=low_effort, 1=high_effort)
High score = do first.

## Impact Scoring (1-5):

- 5: Core business functionality broken/missing
- 4: Key user workflow missing
- 3: Important feature gap
- 2: Nice-to-have feature
- 1: Cosmetic or documentation gap

## Effort Scoring (inverse: 5=low, 1=high):

- 5: < 1 hour (register router, add nav item)
- 4: 1-2 hours (new page from template)
- 3: 2-4 hours (new page + form + API client)
- 2: 4-8 hours (new backend route + frontend)
- 1: > 8 hours or requires schema changes

## Output Format

```
## Priority Matrix — [Date]
| Rank | Gap | Impact | Effort | Score | Action |
|------|-----|--------|--------|-------|--------|
| 1 | Contractors frontend | 4 | 3 | 12 | /pi-fix contractors |
| 2 | Register cron_jobs.py | 3 | 5 | 15 | /pi-fix cron-register |
```

## Usage

/pi-prioritize [optional: gap list from cross-ref]
