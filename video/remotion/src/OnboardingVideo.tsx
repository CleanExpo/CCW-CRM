/**
 * CCW Onboarding Video — Remotion Composition
 *
 * Sections:
 *   00:00–00:30  Scene 1 — Welcome / What is CCW ERP       (900 frames)
 *   00:30–01:30  Scene 2 — What You'll Need (credentials)  (1800 frames)
 *   01:30–02:00  Scene 3 — What to Expect (timeline)       (900 frames)
 *   02:00–04:20  Scene 4 — Connection Setup (4 × 20s)      (2700 frames)
 *   04:20–04:50  Scene 5 — Go Live + Next Steps            (900 frames)
 *
 * Total: 7200 frames @ 30fps = 240 seconds = 4 minutes
 */

import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { OnboardingIntroScene } from './scenes/onboarding/OnboardingIntroScene';
import { RequirementsScene } from './scenes/onboarding/RequirementsScene';
import { ExpectationsScene } from './scenes/onboarding/ExpectationsScene';
import { ConnectionSetupScene } from './scenes/onboarding/ConnectionSetupScene';
import { GoLiveScene } from './scenes/onboarding/GoLiveScene';

// Frame offsets (30fps)
const FPS = 30;
const INTRO_START = 0;
const INTRO_DURATION = FPS * 30;          // 30s

const REQUIREMENTS_START = INTRO_START + INTRO_DURATION;
const REQUIREMENTS_DURATION = FPS * 60;    // 60s

const EXPECTATIONS_START = REQUIREMENTS_START + REQUIREMENTS_DURATION;
const EXPECTATIONS_DURATION = FPS * 30;    // 30s

const CONNECTIONS_START = EXPECTATIONS_START + EXPECTATIONS_DURATION;
const CONNECTIONS_DURATION = FPS * 80;     // 80s (4 × 20s steps)

const GOLIVE_START = CONNECTIONS_START + CONNECTIONS_DURATION;
const GOLIVE_DURATION = FPS * 30;          // 30s

export const ONBOARDING_TOTAL_FRAMES =
  INTRO_DURATION + REQUIREMENTS_DURATION + EXPECTATIONS_DURATION +
  CONNECTIONS_DURATION + GOLIVE_DURATION;

export const OnboardingVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={INTRO_START} durationInFrames={INTRO_DURATION}>
        <OnboardingIntroScene />
      </Sequence>

      <Sequence from={REQUIREMENTS_START} durationInFrames={REQUIREMENTS_DURATION}>
        <RequirementsScene />
      </Sequence>

      <Sequence from={EXPECTATIONS_START} durationInFrames={EXPECTATIONS_DURATION}>
        <ExpectationsScene />
      </Sequence>

      <Sequence from={CONNECTIONS_START} durationInFrames={CONNECTIONS_DURATION}>
        <ConnectionSetupScene />
      </Sequence>

      <Sequence from={GOLIVE_START} durationInFrames={GOLIVE_DURATION}>
        <GoLiveScene />
      </Sequence>
    </AbsoluteFill>
  );
};
