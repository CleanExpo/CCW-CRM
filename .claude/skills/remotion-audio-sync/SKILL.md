---
name: remotion-audio-sync
description: >
  Generates ElevenLabs narration audio for CCW Remotion videos and syncs it
  with scene animations. Covers script writing, audio generation, Remotion Audio
  component integration, and timing alignment between voice and visuals.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
---

## CCW Intro Video Audio Scripts

**Voice**: Rachel (ID: 21m00Tcm4TlvDq8ikWAM) — default ElevenLabs voice
**Pacing**: ~140 words/minute at natural speaking pace
**Style**: Warm, direct, Australian business context. No corporate speak.

**Narration files** (stored in `video/remotion/public/audio/`):

| File | Video | Duration | Words |
|---|---|---|---|
| firstlook-narration.mp3 | FirstLookVideo | ~180s | ~420 words |
| connections-narration.mp3 | ConnectionsGuideVideo | ~300s | ~700 words |

## Audio Generation Steps

```bash
# Set your API key
export ELEVENLABS_API_KEY=your_key_here

# Generate audio for specific video
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM"
node scripts/generate-intro-audio.js firstlook     # FirstLookVideo only
node scripts/generate-intro-audio.js connections   # ConnectionsGuideVideo only
node scripts/generate-intro-audio.js all           # Both

# OR use npm scripts from remotion dir
cd video/remotion
npm run generate:audio:all
```

## Remotion Audio Integration Pattern

```tsx
import { Audio, staticFile } from 'remotion';

// In your composition component:
{narrationPath && <Audio src={staticFile(narrationPath)} />}
```

- `staticFile()` resolves paths relative to `video/remotion/public/`
- Audio file must be in `video/remotion/public/audio/` folder
- Audio plays from frame 0 automatically
- No additional sync needed — audio and visuals both start at frame 0

## Scene Timing Alignment

Match scene durations to narration segments:

| FirstLookVideo Scene | Start | Duration | Words |
|---|---|---|---|
| HeroScene | 0s | 30s | ~70 words |
| ProblemScene | 30s | 30s | ~70 words |
| ModuleShowcaseScene | 60s | 45s | ~105 words |
| WorkflowScene | 105s | 30s | ~70 words |
| WhoItsForScene | 135s | 20s | ~47 words |
| GetStartedScene | 155s | 25s | ~58 words |

| ConnectionsGuideVideo Scene | Start | Duration | Words |
|---|---|---|---|
| ConnectionsIntroScene | 0s | 20s | ~47 words |
| Cin7 Step | 20s | 50s | ~117 words |
| Xero Step | 70s | 50s | ~117 words |
| Supabase Step | 120s | 50s | ~117 words |
| Vercel+Railway Step | 170s | 60s | ~140 words |
| VerificationScene | 230s | 40s | ~93 words |
| AllConnectedScene | 270s | 30s | ~70 words |

## If Audio and Visuals Fall Out of Sync

1. Check word count of the narration segment vs scene duration
2. Adjust scene `durationInFrames` to match (duration_seconds x 30 = frames)
3. Re-render: `npm run render:firstlook`
4. Preview in Studio: `npm start` — scrub timeline to check alignment

## Adding Audio to a New Video

1. Write narration script (target: duration_seconds x 2.33 words)
2. Add script constant to `scripts/generate-intro-audio.js`
3. Add `generate:audio:[name]` npm script
4. Add `<Audio src={staticFile(narrationPath)} />` to composition
5. Add `narrationPath` to composition defaultProps in Root.tsx
6. Run: `node scripts/generate-intro-audio.js [name]`

## .gitignore Note

MP3 files are gitignored (binary, too large). They must be regenerated on each machine:

```
video/remotion/public/audio/*.mp3
```

Add this line to the root `.gitignore` if not present.
