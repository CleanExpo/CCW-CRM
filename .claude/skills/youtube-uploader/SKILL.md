---
name: youtube-uploader
description: >
  Autonomously uploads CCW HeyGen demo videos to YouTube as Unlisted,
  collects video IDs, and patches DemoVideoBanner.tsx + video-registry.json.
  One-time OAuth setup required. Handles resume, retries, and ID propagation.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
---

# YouTube Uploader Skill

## Purpose

Upload all 24 CCW ERP demo videos from `data/heygen/downloads/` to YouTube as **Unlisted**,
then automatically update `DemoVideoBanner.tsx` and `video-registry.json` with the YouTube IDs.

## Prerequisites

### One-Time OAuth Setup (first run only)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services → Library → search "YouTube Data API v3" → Enable**
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Desktop app**
   - Name: `CCW YouTube Uploader`
4. Download JSON → save to `scripts/youtube_oauth_client.json`
5. Run auth flow:
   ```bash
   cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
   python scripts/youtube_upload.py --auth
   ```
   (Opens browser once — sign in as contact@unite-group.in or whichever account owns the channel — approve. Token cached at `scripts/.youtube_token.json`.)

### Files Required

| File                                                | Description                        |
| --------------------------------------------------- | ---------------------------------- |
| `data/heygen/downloads/*.mp4`                       | 24 downloaded HeyGen videos        |
| `scripts/youtube_oauth_client.json`                 | Google OAuth credentials           |
| `data/heygen/video-registry.json`                   | Registry to patch with YouTube IDs |
| `apps/web/components/dashboard/DemoVideoBanner.tsx` | Banner component to patch          |

## Usage

### Check status (no uploads, just report)

```bash
python scripts/youtube_upload.py --status
```

### Upload all pending videos

```bash
python scripts/youtube_upload.py --upload
```

- Uploads each MP4 as **Unlisted** with CCW-branded title + description + tags
- Resume-safe: saves `data/heygen/youtube-upload-log.json` after each video
- Re-running skips already-uploaded videos
- After all uploads: auto-patches `video-registry.json` + `DemoVideoBanner.tsx`

### Patch files only (if uploads done, just need to update code)

```bash
python scripts/youtube_upload.py --patch-only
```

### Commit after upload

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
git add data/heygen/youtube-upload-log.json data/heygen/video-registry.json apps/web/components/dashboard/DemoVideoBanner.tsx
git commit -m "feat(youtube): add YouTube IDs for all 24 CCW demo videos"
git push origin fix/railway-cache-auth-500
```

## What Gets Updated

### `data/heygen/video-registry.json`

Each video entry gets:

```json
{
  "youtubeId": "dQw4w9WgXcQ",
  "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
  "status": "published"
}
```

### `apps/web/components/dashboard/DemoVideoBanner.tsx`

Each `youtubeId: null` entry gets patched to:

```typescript
youtubeId: "dQw4w9WgXcQ",
```

### `data/heygen/youtube-upload-log.json`

Full upload audit log with timestamps:

```json
{
  "dashboard": {
    "youtubeId": "dQw4w9WgXcQ",
    "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
    "title": "CCW ERP — Dashboard Overview",
    "uploadedAt": "2026-04-01T10:00:00Z"
  }
}
```

## When Claude Runs This Autonomously

```bash
# Step 1: Verify downloads exist
python -c "
import os
d = r'C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\data\heygen\downloads'
files = os.listdir(d)
print(f'{len(files)} MP4 files ready')
"

# Step 2: Check upload status
python scripts/youtube_upload.py --status

# Step 3: If oauth token exists, upload
python scripts/youtube_upload.py --upload

# Step 4: Run TypeScript check
cd apps/web && npx tsc --noEmit

# Step 5: Commit everything
git add data/heygen/youtube-upload-log.json data/heygen/video-registry.json \
        apps/web/components/dashboard/DemoVideoBanner.tsx
git commit -m "feat(youtube): add YouTube IDs for all 24 CCW demo videos"
git push origin fix/railway-cache-auth-500
```

## Video Settings

All videos uploaded with:

- **Privacy**: Unlisted (internal training — not searchable)
- **Category**: Science & Technology (ID 28)
- **Language**: en-AU
- **Tags**: CCW ERP, equipment supplier, inventory management, Australia, trades business, Cin7, Xero
- **Made for kids**: No

## Files

- **Upload script**: `scripts/youtube_upload.py`
- **OAuth creds**: `scripts/youtube_oauth_client.json` (you provide)
- **Token cache**: `scripts/.youtube_token.json` (auto-generated)
- **Upload log**: `data/heygen/youtube-upload-log.json` (auto-generated)

## Troubleshooting

| Error                                       | Fix                                                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `File not found: youtube_oauth_client.json` | Download OAuth creds from Google Cloud Console                                                                        |
| `Token expired`                             | Re-run `--auth` to refresh                                                                                            |
| `quotaExceeded`                             | YouTube API quota = 10,000 units/day. Each upload = ~1,600 units. 6 uploads/day max. Resume next day with `--upload`. |
| `Upload failed at X%`                       | Re-run `--upload` — resumes from where it left off                                                                    |
| `youtubeId: null` still in banner           | Run `--patch-only` after log is populated                                                                             |
