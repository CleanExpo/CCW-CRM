---
name: remotion-video-producer
version: 1.0.0
description: |
  Orchestrates end-to-end production of CCW ERP Remotion walkthrough videos.
  Covers scripting, scene planning, composition assembly, rendering, and YouTube upload.
  Entry point for producing any new CCW training or marketing video.
  Use when: creating a new video from scratch, extending an existing video with new scenes,
  or running the full produce-and-publish workflow.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Agent
---

# Remotion Video Producer

## Video Catalog

All CCW Remotion videos — check this before starting any new production.

| ID | Composition ID | Duration | Purpose | Status |
|----|---------------|----------|---------|--------|
| 1 | `BoardroomVideo` | 150s | AI boardroom deliberation | Built |
| 2 | `OnboardingVideo` | 240s | New user onboarding overview | Built |
| 3 | `FirstLookVideo` | 180s | System first look / sales | Built |
| 4 | `ConnectionsGuideVideo` | 300s | API setup walkthrough | Built |
| 5 | *(future)* | TBD | Module deep-dives | Planned |

---

## Production Workflow (5 Steps)

### Step 1 — Script

Write the narration script for each scene. Follow these pacing rules:

- ~140 words per minute
- Each scene = one narration segment
- Strip SSML, stage directions, and screen references ("click X" → "head to X")
- Target word counts by scene duration:

| Scene length | Target words |
|-------------|-------------|
| 3s | ~7 |
| 5s | ~12 |
| 10s | ~23 |
| 15s | ~35 |
| 20s | ~47 |
| 30s | ~70 |

Save scripts as comments inside each scene file or in a companion `script.md` in the scenes folder.

---

### Step 2 — Plan

Map the script to a scene timeline. Convert seconds to frames (× 30):

**Example plan for a 180s / 5400-frame video:**

| Scene | Start (s) | Duration (s) | Start (frame) | Duration (frames) | Purpose |
|-------|-----------|-------------|--------------|-------------------|---------|
| Intro | 0 | 5 | 0 | 150 | Title card |
| Overview | 5 | 20 | 150 | 600 | What is CCW ERP |
| Feature 1 | 25 | 15 | 750 | 450 | Key feature #1 |
| Feature 2 | 40 | 15 | 1200 | 450 | Key feature #2 |
| Feature 3 | 55 | 15 | 1650 | 450 | Key feature #3 |
| CTA | 70 | 10 | 2100 | 300 | Call to action |
| Outro | 80 | 5 | 2400 | 150 | Sign-off |

Verify: sum of all durations (frames) must equal total `durationInFrames` in `Root.tsx`.

---

### Step 3 — Build

Create scene TSX files using the `remotion-scene-builder` skill:

1. Create folder: `video/remotion/src/scenes/[video-name]/`
2. Create one TSX file per scene following the scene template
3. Create the composition file: `video/remotion/src/[VideoName]Video.tsx`
   - Import all scene components
   - Compose them in `<Sequence from={N} durationInFrames={M}>` blocks
   - Export a `[VIDEO_NAME]_TOTAL_FRAMES` constant
4. Run TypeScript check: `npx tsc --noEmit` from the remotion directory

**Composition file skeleton:**

```tsx
/**
 * [VideoName]Video — CCW ERP [purpose]
 * Total: [N]s at 30fps = [N*30] frames
 */
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Scene1 } from './scenes/[video-name]/Scene1';
import { Scene2 } from './scenes/[video-name]/Scene2';
// ... more scenes

export const [VIDEO_NAME]_TOTAL_FRAMES = 30 * [N]; // [N] seconds

export const [VideoName]Video: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={150}>
        <Scene1 />
      </Sequence>
      <Sequence from={150} durationInFrames={600}>
        <Scene2 />
      </Sequence>
      {/* continue... */}
    </AbsoluteFill>
  );
};
```

---

### Step 4 — Register

After building the composition, register it so it renders correctly.

**4a. Add to `video/remotion/src/Root.tsx`:**

```tsx
import { [VideoName]Video, [VIDEO_NAME]_TOTAL_FRAMES } from './[VideoName]Video';

// Inside the Root component's return:
<Composition
  id="[VideoName]Video"
  component={[VideoName]Video}
  durationInFrames={[VIDEO_NAME]_TOTAL_FRAMES}
  fps={30}
  width={1920}
  height={1080}
  defaultProps={{}}
/>
```

**4b. Add render script to `video/remotion/package.json`:**

```json
"render:[video-name]": "remotion render src/index.ts [VideoName]Video out/[video-name].mp4"
```

**4c. Add `render:all` script update** — include the new render in the composite command:

```json
"render:all": "npm run render:firstlook && npm run render:connections && npm run render:onboarding && npm run build && npm run render:[video-name]"
```

**4d. (If it's a module training video)** Add to `VIDEO_REGISTRY` in `DemoVideoBanner.tsx`:

```tsx
// apps/web/components/dashboard/DemoVideoBanner.tsx
{ id: '[video-id]', youtubeId: '', title: '[Video Title]', description: '...' }
```

Leave `youtubeId` empty — it gets patched after YouTube upload (Step 5 of render pipeline).

---

### Step 5 — Render

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion"
npm run render:[video-name]
# Output: out/[video-name].mp4
```

After rendering, hand off to `remotion-render-pipeline` for validation, upload, and publishing.

---

## Render Commands (All Videos)

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion"

npm run render:firstlook        # → out/firstlook.mp4       (180s)
npm run render:connections      # → out/connections-guide.mp4  (300s)
npm run render:onboarding       # → out/onboarding.mp4      (240s)
npm run build                   # → out/boardroom.mp4       (150s)
npm run render:all              # Render all 4 in sequence
```

Expected render time per video: ~2–5 minutes on a modern Windows machine.

---

## After Rendering — Upload to YouTube

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"

# Step 1: Copy rendered file to YouTube upload queue
copy video\remotion\out\firstlook.mp4 data\videos\downloads\firstlook.mp4

# Step 2: Upload (appends to the existing 10-video upload log)
python scripts/youtube_upload.py --upload

# Step 3: Check status + retrieve new video IDs
python scripts/youtube_upload.py --status
```

See `remotion-render-pipeline` for the full validated pipeline including DemoVideoBanner patching.

---

## Scene File Locations

| Video | Scene Directory |
|-------|----------------|
| Boardroom | `video/remotion/src/scenes/` |
| Onboarding | `video/remotion/src/scenes/onboarding/` |
| First Look | `video/remotion/src/scenes/firstlook/` |
| Connections Guide | `video/remotion/src/scenes/connections/` |
| New video | `video/remotion/src/scenes/[video-name]/` |

---

## Adding a New Video — Checklist

- [ ] Create scene files under `video/remotion/src/scenes/[video-name]/`
- [ ] Create composition file `video/remotion/src/[VideoName]Video.tsx`
- [ ] Add composition to `video/remotion/src/Root.tsx`
- [ ] Add render script to `video/remotion/package.json`
- [ ] Run `npx tsc --noEmit` — fix all TypeScript errors before rendering
- [ ] Preview in Remotion Studio (`npm start`) — scrub all scenes
- [ ] Add to `VIDEO_REGISTRY` in `apps/web/components/dashboard/DemoVideoBanner.tsx` if module training
- [ ] Add `VIDEO_METADATA` entry in `scripts/youtube_upload.py`
- [ ] Run `remotion-render-pipeline` to render, validate, upload, and patch

---

## VIDEO_METADATA Entries (scripts/youtube_upload.py)

When adding a new video to the upload script, append to the `VIDEO_METADATA` dict:

```python
VIDEO_METADATA = {
    # Existing entries...
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
    # Add new entries here using the same pattern:
    "[video-name]": {
        "title": "CCW ERP — [Human-readable title]",
        "desc": "[2-sentence description under 200 chars for YouTube]"
    },
}
```

---

## Reference Files

- `video/remotion/src/Root.tsx` — composition registry
- `video/remotion/src/BoardroomVideo.tsx` — reference for Sequence composition
- `video/remotion/src/OnboardingVideo.tsx` — reference for longer multi-scene video
- `video/remotion/package.json` — render scripts
- `apps/web/components/dashboard/DemoVideoBanner.tsx` — VIDEO_REGISTRY
- `scripts/youtube_upload.py` — YouTube upload + VIDEO_METADATA
- `.claude/skills/remotion-scene-builder/SKILL.md` — scene building reference
- `.claude/skills/remotion-render-pipeline/SKILL.md` — full render-to-live pipeline
