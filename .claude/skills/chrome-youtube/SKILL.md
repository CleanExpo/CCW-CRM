# CHROME-YOUTUBE-UPLOAD SKILL

**Skill Name**: chrome-youtube-upload
**Version**: 1.0.0
**Trigger**: `/chrome-youtube`, "upload to youtube", "open youtube studio", "schedule youtube video"
**Description**: Open YouTube Studio in Chrome to upload, schedule, or manage CCW demo and boardroom videos when the API quota is exhausted or OAuth setup is incomplete.

---

## SKILL PURPOSE

Automate or assist YouTube video management for the CCW channel through the browser UI. This is the fallback path when `python scripts/youtube_upload.py` cannot run due to API quota limits or OAuth issues.

---

## WHEN TO USE THIS SKILL

- YouTube Data API daily quota is exhausted (resets midnight Pacific)
- OAuth token needs re-authorisation
- Uploading videos manually with specific scheduling
- Checking upload status of previously submitted videos
- Updating video titles, descriptions, or chapter timestamps

**Trigger phrases:**
- "upload this video to youtube"
- "open youtube studio"
- "check my youtube uploads"
- `/chrome-youtube`

---

## EXECUTION PROTOCOL

### Step 1: Open YouTube Studio

```
mcp__Claude_in_Chrome__navigate: https://studio.youtube.com
```

Screenshot to confirm login and channel:
```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Confirm channel name matches CCW channel. If wrong account → stop and tell user.

### Step 2: Check Channel ID

Navigate to Settings → Channel → Advanced settings:
```
mcp__Claude_in_Chrome__navigate: https://studio.youtube.com/channel/settings/advanced
mcp__Claude_in_Chrome__get_page_text
```

Extract the Channel ID and confirm it matches `UChN8nQFig73BoefyMBIsN-w`.
If mismatch → report to user before proceeding.

### Step 3: Check Upload Status (Content tab)

```
mcp__Claude_in_Chrome__navigate: https://studio.youtube.com/channel/videos
mcp__Claude_in_Chrome__get_page_text
```

Extract video list:
```
| Title                              | Status     | Visibility  |
|------------------------------------|------------|-------------|
| CCW Demo - Onboarding Walkthrough  | Published  | Public      |
| CCW Boardroom EP001               | Processing | Unlisted    |
```

Compare against `data/heygen/video-registry.json` upload status.

### Step 4: Upload New Video

**Requires user confirmation before proceeding.**

"Ready to upload `[filename]`. This will open the upload dialog. Confirm?"

After confirmation:
1. Click "Create" → "Upload videos"
2. The file picker opens — tell user which file to select (cannot do file picking autonomously)
3. Wait for processing to complete
4. Fill in title, description, and tags from the episode JSON data

For Episode 1 title and description, read from:
`video/remotion/src/data/episode-1.json`

```
mcp__Claude_in_Chrome__form_input: { selector: "#title-textarea", text: "[title from JSON]" }
mcp__Claude_in_Chrome__form_input: { selector: "#description-textarea", text: "[description from JSON]" }
```

### Step 5: Set Visibility and Schedule

1. Select "Schedule" visibility
2. Set date and time (user-specified or default to next day 9am AEST)
3. Click "Schedule" to confirm

```
mcp__Claude_in_Chrome__computer: { action: "screenshot" }
```

Report: video URL, scheduled time, visibility setting.

### Step 6: Add Chapter Timestamps

In the description field, append YouTube chapter markers from `videoBrief.youtube.chapters`:

```
0:00 Intro
0:05 Intelligence Brief
0:35 Build Status
...
```

### Step 7: Update video-registry.json

After upload, report the YouTube video ID and URL. User should update:
`data/heygen/video-registry.json` with:
- `youtube_url`: the new video URL
- `upload_status`: "uploaded"
- `youtube_video_id`: extracted from the URL

---

## DAILY QUOTA MANAGEMENT

YouTube API quota: 10,000 units/day. Resets midnight Pacific.
Upload = 1,600 units. Max ~6 uploads per day via API.

Browser upload has no API quota. Use this skill for bulk upload days.

---

## VERIFICATION

- Video appears in Content list with correct title
- Status shows "Processing" → "Published" or "Scheduled"
- Chapter timestamps parse correctly in YouTube (check the "..." menu on the video)

---

## BLOCKERS

- **Not logged in**: Stop. User must log in to the CCW YouTube account in Chrome.
- **File picker**: Cannot click file system pickers — user must select the file manually.
- **2FA / channel switch**: Stop and guide user through manually.

---

**Version**: 1.0
**Created**: April 2026
**Tools**: `mcp__Claude_in_Chrome__*`
**Related files**: `scripts/youtube_upload.py`, `data/heygen/video-registry.json`
