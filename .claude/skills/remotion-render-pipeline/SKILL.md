---
name: remotion-render-pipeline
version: 1.0.0
description: |
  Renders CCW Remotion videos to MP4, validates output, copies to YouTube upload queue,
  triggers the YouTube upload script, patches DemoVideoBanner.tsx with new IDs,
  and commits + pushes all changes. Full render-to-live pipeline.
  Use when: any CCW Remotion video needs to be rendered and published to YouTube.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
---

# Remotion Render Pipeline

## Full Pipeline (run in this exact order)

### Step 1 — Render the Video

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion"
npm run render:[video-name]
# Examples:
#   npm run render:firstlook       → out/firstlook.mp4
#   npm run render:connections     → out/connections-guide.mp4
#   npm run render:onboarding      → out/onboarding.mp4
#   npm run build                  → out/boardroom.mp4
#   npm run render:all             → all 4 videos
```

If the render command does not exist yet, add it to `video/remotion/package.json` before running.
See `remotion-video-producer` Step 4 for the format.

---

### Step 2 — Validate Output

```bash
ls -la "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion\out\[video-name].mp4"
```

**Validation criteria — ALL must pass before continuing:**

| Check | Pass condition |
|-------|---------------|
| File exists | `ls` returns the file without error |
| File size | Must be > 1 MB (small file = failed/empty render) |
| File name matches | Matches the expected output name from the render script |

If validation fails:
- Re-run the render command
- Check for TypeScript errors first: `npx tsc --noEmit`
- Check Remotion Studio preview: `npm start`
- Do NOT proceed to upload with an invalid file

---

### Step 3 — Copy to YouTube Upload Queue

```bash
# Windows path — use forward slashes in bash
cp "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion\out\[video-name].mp4" \
   "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\data\videos\downloads\[video-name].mp4"
```

The upload script reads from `data/videos/downloads/`. The filename must match the key in `VIDEO_METADATA` inside `scripts/youtube_upload.py`.

---

### Step 4 — Upload to YouTube

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
python scripts/youtube_upload.py --upload
```

This script:
- Reads all files from `data/videos/downloads/`
- Matches filenames to `VIDEO_METADATA` dict for title + description
- Uploads each to the CCW YouTube channel
- Appends results (video ID, YouTube URL, upload timestamp) to `data/videos/youtube-upload-log.json`

If the command exits with a quota error, see the **Quota Awareness** section below.

---

### Step 5 — Check Upload Log for New IDs

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
python scripts/youtube_upload.py --status
```

Or read the log directly:

```bash
cat "data/videos/youtube-upload-log.json"
```

Note the `youtubeId` (format: `dQw4w9WgXcQ`) for each uploaded video — you need it for Step 6.

---

### Step 6 — Patch DemoVideoBanner.tsx with New YouTube IDs

Read the upload log, then manually update the `VIDEO_REGISTRY` in `DemoVideoBanner.tsx`.

**File:** `apps/web/components/dashboard/DemoVideoBanner.tsx`

Find the registry entry for the uploaded video and set `youtubeId`:

```tsx
// Before:
{ id: 'firstlook', youtubeId: '', title: 'Your First Look', description: '...' }

// After (with real YouTube ID from upload log):
{ id: 'firstlook', youtubeId: 'dQw4w9WgXcQ', title: 'Your First Look', description: '...' }
```

Do NOT use `--patch-only` flag on the upload script — it does not match the banner format.
Patch manually by reading the log and editing the file directly.

---

### Step 7 — TypeScript Check

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
npx tsc --noEmit --project apps/web/tsconfig.json
```

Must return zero errors before committing. If errors appear, fix them before Step 8.

---

### Step 8 — Commit and Push

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
git add data/videos/ apps/web/components/dashboard/DemoVideoBanner.tsx video/remotion/
git commit -m "feat(video): render and publish [video-name] to YouTube"
git push origin fix/railway-cache-auth-500
```

**Note:** `video/remotion/out/` is gitignored — MP4 files are NOT committed.
Only the updated `package.json` (new render scripts), `Root.tsx`, and scene files are committed.

---

## Quota Awareness

YouTube Data API v3 limits apply to all uploads.

| Metric | Value |
|--------|-------|
| Daily quota | 10,000 units |
| Cost per upload | ~1,600 units |
| Max uploads per day | ~6 videos |
| Quota reset time | Midnight Pacific (approx. 5–6pm AEST) |

**If quota is exceeded:**
- The upload script will exit with a `quotaExceeded` error
- Do NOT retry in a loop — wait for quota reset
- The automated daily cron runs at **7:07pm AEST** (youtube-upload-ccw-training scheduled task)
- The cron will pick up any files still in `data/videos/downloads/` automatically
- Check cron status in Windows Task Scheduler or run manually after reset

**To check quota remaining:**
```bash
python scripts/youtube_upload.py --status
```

---

## VIDEO_METADATA Additions

When adding a new Remotion video to the upload pipeline, add its entry to the `VIDEO_METADATA` dict in `scripts/youtube_upload.py`:

```python
VIDEO_METADATA = {
    "firstlook": {
        "title": "CCW ERP — Your First Look",
        "desc": "A complete overview of CCW ERP CRM. What it is, what it does, and how to start your journey as an Australian equipment supplier."
    },
    "connections-guide": {
        "title": "CCW ERP — API Connections Setup Guide",
        "desc": "Step-by-step: connect Cin7, Xero, Supabase, Vercel and Railway to get CCW ERP fully operational in under 30 minutes."
    },
    "onboarding": {
        "title": "CCW ERP — Onboarding Overview",
        "desc": "What to expect in your first 5 days: requirements, connections, data migration, team setup, and go-live checklist."
    },
    # Add new entries here:
    "[video-filename-without-extension]": {
        "title": "CCW ERP — [Human-readable title]",
        "desc": "[2-sentence YouTube description, keep under 200 chars]"
    },
}
```

The key must exactly match the filename (without `.mp4`) placed in `data/videos/downloads/`.

---

## Output Directory

`video/remotion/out/` — gitignored. Never commit MP4 files.

The `.gitignore` already excludes this directory. Verify with:

```bash
git status video/remotion/out/
# Should show: nothing to commit (if correctly gitignored)
```

---

## Batch Render Pipeline (All 4 Videos)

To render and publish all videos in one session:

```bash
# Step 1: Render all
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion"
npm run render:all

# Step 2: Validate (check all 4 exist and are > 1MB)
ls -la out/

# Step 3: Copy all to upload queue
cp out/firstlook.mp4       ../../../data/videos/downloads/firstlook.mp4
cp out/connections-guide.mp4 ../../../data/videos/downloads/connections-guide.mp4
cp out/onboarding.mp4      ../../../data/videos/downloads/onboarding.mp4
cp out/boardroom.mp4       ../../../data/videos/downloads/boardroom.mp4

# Step 4: Upload (will stop at 6 — split across 2 days if needed due to quota)
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
python scripts/youtube_upload.py --upload

# Step 5: Get IDs
python scripts/youtube_upload.py --status

# Steps 6-8: Patch DemoVideoBanner.tsx, TypeScript check, commit + push
```

---

## Quick-Reference: File Paths

| File | Path |
|------|------|
| Render scripts | `video/remotion/package.json` |
| Root composition | `video/remotion/src/Root.tsx` |
| Output MP4s | `video/remotion/out/` (gitignored) |
| Upload queue | `data/videos/downloads/` |
| Upload script | `scripts/youtube_upload.py` |
| Upload log | `data/videos/youtube-upload-log.json` |
| Video banner component | `apps/web/components/dashboard/DemoVideoBanner.tsx` |

---

## Reference Skills

- `.claude/skills/remotion-scene-builder/SKILL.md` — build individual scenes
- `.claude/skills/remotion-video-producer/SKILL.md` — full production orchestration
