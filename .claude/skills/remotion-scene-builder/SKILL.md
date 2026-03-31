---
name: remotion-scene-builder
version: 1.0.0
description: |
  Creates production-ready Remotion scene TSX files for CCW ERP walkthrough videos.
  Follows established patterns from existing scenes (BoardroomVideo, OnboardingVideo).
  Handles animation timing, interpolation, and CCW brand guidelines.
  Use when: building a new scene for any CCW Remotion video, editing existing scenes,
  or debugging animation/layout issues.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
---

# Remotion Scene Builder

## CCW Brand Colors

Use these exact values — no Tailwind classes in Remotion scenes (inline styles only).

| Role | Value | Use For |
|------|-------|---------|
| Dark navy (primary bg) | `#0f172a` | Main scene backgrounds |
| Deep blue | `#1e3a5f` | Gradient end, card backs |
| Brand blue | `#3b82f6` | CTA buttons, active states, highlights |
| Purple accent | `#8b5cf6` | Decorative accents, gradient midpoint |
| Cyan accent | `#06b6d4` | Gradient tail, data visualisation |
| White text | `#ffffff` | H1/H2 headings on dark bg |
| Muted text | `#94a3b8` | Subtitles, dates, metadata |
| Dim text | `#475569` | Session IDs, captions, fine print |
| Light blue highlight | `#60a5fa` | Branded eyebrow labels (e.g. "CCW ERP") |
| Success green | `#22c55e` | Tick icons, positive status |
| Warning amber | `#f59e0b` | In-progress indicators |
| Error red | `#ef4444` | Failure states (use sparingly) |

**Standard background gradient:**
```tsx
background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'
```

**Brand accent bar** (always pin to bottom of scene):
```tsx
<div style={{
  position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
  background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
}} />
```

---

## Animation Patterns

Always import from `remotion` — never from sub-packages unless needed.

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
```

### Fade In from Bottom (standard entry)

```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
  extrapolateRight: 'clamp',
});
const slideY = interpolate(frame, [0, fps * 0.5], [40, 0], {
  extrapolateRight: 'clamp',
});

// Apply as: style={{ opacity, transform: `translateY(${slideY}px)` }}
```

### Staggered Children (multiple items entering one by one)

```tsx
// Each item starts fps * 0.15 frames after the previous
const itemOpacity = (index: number) =>
  interpolate(frame, [index * fps * 0.15, index * fps * 0.15 + fps * 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
```

### Fade Out (for outro / exit scenes)

```tsx
// Start fadeout 1 second before scene ends — pass durationInFrames as prop or via useVideoConfig
const { durationInFrames, fps } = useVideoConfig();
const fadeOut = interpolate(
  frame,
  [durationInFrames - fps, durationInFrames],
  [1, 0],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);
```

### Progress Bar (timed fill)

```tsx
const progressWidth = interpolate(frame, [0, durationInFrames], [0, 100], {
  extrapolateRight: 'clamp',
});
// Use as: style={{ width: `${progressWidth}%` }}
```

### Scale Pulse (draw attention to a UI element)

```tsx
const scale = interpolate(
  frame % (fps * 2),          // repeat every 2 seconds
  [0, fps * 0.1, fps * 0.2],
  [1, 1.05, 1],
  { extrapolateRight: 'clamp' }
);
// Apply as: style={{ transform: `scale(${scale})` }}
```

---

## Scene Structure Template

Every scene follows this skeleton. Copy, rename, and fill in the body.

```tsx
/**
 * Scene: [SceneName] — [Video Name] (UNI-XXXX)
 * [One-line description of what this scene shows]
 * Duration: ~[N] seconds
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface [SceneName]Props {
  // Define any data props here
}

export const [SceneName]: React.FC<[SceneName]Props> = ({ /* props */ }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Animations ---
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const slideY = interpolate(frame, [0, fps * 0.5], [40, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Main content */}
      <div style={{ opacity, transform: `translateY(${slideY}px)`, textAlign: 'center' }}>
        {/* Eyebrow label */}
        <div style={{ fontSize: 18, color: '#60a5fa', letterSpacing: 6, fontWeight: 600,
          textTransform: 'uppercase', marginBottom: 16 }}>
          CCW ERP
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 64, color: '#ffffff', fontWeight: 800, lineHeight: 1.1,
          maxWidth: 1000, textAlign: 'center', margin: '0 auto' }}>
          Scene Headline
        </h1>

        {/* Subtext */}
        <p style={{ marginTop: 24, fontSize: 22, color: '#94a3b8', maxWidth: 700,
          lineHeight: 1.6, textAlign: 'center', margin: '24px auto 0' }}>
          Supporting text goes here.
        </p>
      </div>

      {/* Brand accent bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
      }} />
    </AbsoluteFill>
  );
};
```

---

## Timing Guide (30fps)

All CCW videos run at **30fps**. Use these frame counts for scene durations.

| Duration | Frames | Use for |
|----------|--------|---------|
| 1s | 30 | Quick transition, label pop |
| 2s | 60 | Short callout card |
| 3s | 90 | Title card, section intro |
| 4s | 120 | Feature highlight |
| 5s | 150 | Standard scene (default) |
| 7s | 210 | Complex scene with multiple steps |
| 10s | 300 | Deep walkthrough, multi-panel |
| 15s | 450 | Full UI demo segment |
| 20s | 600 | Extended demo with narration |
| 30s | 900 | Long sequence (use sparingly) |

**Fade-in ramp:** `fps * 0.5` (15 frames = 0.5s) — standard for most scenes.
**Stagger delay per item:** `fps * 0.15` (4-5 frames) — feels snappy, not laggy.
**Fade-out lead:** `fps * 1` (30 frames) — begin 1s before scene end.

---

## Typography Rules

All type is set with `fontFamily: 'Inter, sans-serif'`.

| Element | fontSize | fontWeight | color |
|---------|----------|------------|-------|
| Display H1 (hero title) | 72–80 | 800 | `#ffffff` |
| Section H1 | 56–64 | 800 | `#ffffff` |
| H2 subheading | 36–44 | 700 | `#ffffff` |
| H3 card title | 24–28 | 600 | `#ffffff` |
| Eyebrow / label | 16–20 | 600 | `#60a5fa` |
| Body / subtitle | 20–24 | 400 | `#94a3b8` |
| Caption / meta | 14–16 | 400 | `#475569` |
| Monospace (IDs) | 14 | 400 | `#475569`, fontFamily: `monospace` |
| Stat number (large) | 64–96 | 800 | `#3b82f6` or `#ffffff` |

**Letter spacing:**
- Eyebrow labels: `letterSpacing: 6–8`
- Normal body text: `letterSpacing: 0`
- ALL CAPS labels: `letterSpacing: 4`

---

## Layout Patterns

### Full-bleed centre card (most common)

```tsx
<AbsoluteFill style={{ ...bgGradient, display: 'flex', alignItems: 'center',
  justifyContent: 'center' }}>
  <div style={{ maxWidth: 900, textAlign: 'center', padding: '0 80px' }}>
    {/* content */}
  </div>
</AbsoluteFill>
```

### Split screen (left text / right visual)

```tsx
<AbsoluteFill style={{ ...bgGradient, display: 'flex', flexDirection: 'row' }}>
  {/* Left: text */}
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
    justifyContent: 'center', padding: '80px 60px 80px 120px' }}>
    {/* headings, bullets */}
  </div>
  {/* Right: screenshot / diagram / icon */}
  <div style={{ flex: 1, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '80px 120px 80px 60px' }}>
    {/* visual */}
  </div>
</AbsoluteFill>
```

### 2-column card grid

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40,
  padding: '0 120px', width: '100%', maxWidth: 1400 }}>
  {items.map((item, i) => (
    <div key={i} style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 16,
      padding: '40px',
      border: '1px solid rgba(255,255,255,0.08)',
      opacity: itemOpacity(i),
    }}>
      {/* card content */}
    </div>
  ))}
</div>
```

### 3-column stat row

```tsx
<div style={{ display: 'flex', gap: 60, justifyContent: 'center', marginTop: 60 }}>
  {stats.map((stat, i) => (
    <div key={i} style={{ textAlign: 'center', opacity: itemOpacity(i) }}>
      <div style={{ fontSize: 72, fontWeight: 800, color: '#3b82f6' }}>{stat.value}</div>
      <div style={{ fontSize: 18, color: '#94a3b8', marginTop: 8 }}>{stat.label}</div>
    </div>
  ))}
</div>
```

---

## How to Add a New Scene to an Existing Composition

**Step 1:** Create the scene file.
```
video/remotion/src/scenes/[video-name]/[SceneName]Scene.tsx
```

**Step 2:** Calculate frame offset in the parent composition file (e.g. `OnboardingVideo.tsx`):
```tsx
import { Sequence } from 'remotion';
import { MyNewScene } from './scenes/[video-name]/MyNewScene';

// Example: scene starts at frame 600, runs for 150 frames (5s)
<Sequence from={600} durationInFrames={150}>
  <MyNewScene someProp="value" />
</Sequence>
```

**Step 3:** Update the composition's `durationInFrames` total in `Root.tsx` if the video got longer.

**Step 4:** Preview in Remotion Studio:
```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion"
npm start   # opens localhost:3000 — scrub timeline to verify
```

---

## Testing: Remotion Studio Preview

```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion"
npm start
```

- Opens at `http://localhost:3000`
- Select your composition from the left panel
- Scrub the timeline to verify all scenes animate correctly
- Check frame 0 (should show first frame of scene) and last frame

**TypeScript check (run before every render):**
```bash
cd "C:\Users\PhillMcGurk\CCW COWORK\CCW-CRM\video\remotion"
npx tsc --noEmit
```

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Missing `extrapolateRight: 'clamp'` on interpolate | Always add `{ extrapolateRight: 'clamp' }` — without it values blow past the target |
| Also missing `extrapolateLeft: 'clamp'` for stagger items | When `from` value > 0, add both clamp options |
| Importing from `@remotion/player` instead of `remotion` | Use `remotion` for all core hooks and `AbsoluteFill` |
| Using Tailwind class strings | Remotion uses inline styles only — no className with Tailwind |
| Hard-coding `fps` as `30` | Always derive from `useVideoConfig()` — never assume |
| Forgetting to export the component | Every scene file must have a named export |
| Using `px` units for large layout values | Use unitless numbers inside `style` objects — React converts them to `px` |
| Scene frame offset wrong in Sequence | Double-check `from` value sums match total duration |
| Font not rendering | `Inter` requires the font to be available; in Remotion bundle you may need `@remotion/google-fonts` |
| Modifying `Root.tsx` without updating total frame count | When adding a scene that extends duration, update `durationInFrames` in `Root.tsx` |

---

## Reference Files

- `video/remotion/src/scenes/IntroScene.tsx` — canonical fade-in pattern
- `video/remotion/src/scenes/BoardMemberScene.tsx` — card grid + stagger animation
- `video/remotion/src/scenes/onboarding/OnboardingIntroScene.tsx` — onboarding style
- `video/remotion/src/BoardroomVideo.tsx` — how Sequence blocks compose a full video
- `video/remotion/src/Root.tsx` — how compositions are registered
