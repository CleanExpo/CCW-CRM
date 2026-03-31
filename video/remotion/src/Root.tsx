/**
 * CCW Boardroom — Remotion Root (UNI-1666)
 */

import React from 'react';
import { Composition } from 'remotion';
import { BoardroomVideo } from './BoardroomVideo';
import { OnboardingVideo, ONBOARDING_TOTAL_FRAMES } from './OnboardingVideo';
import type { BoardroomVideoProps } from './types';

// Default props for Remotion Studio preview
const DEFAULT_PROPS: BoardroomVideoProps = {
  sessionId: 'CCW-BOARD-20260329120000',
  videoBrief: {
    title: 'CCW Boardroom: AI Strategy Session — March 2026',
    description: 'The autonomous CCW boardroom deliberates on AI automation for trades businesses.',
    tags: ['CCW', 'AI', 'trades', 'Australia', 'automation'],
    duration_iso: 'PT8M',
    script: 'Welcome to the CCW Boardroom. Today we explore the latest in AI automation for trades businesses across Australia and New Zealand.',
    youtube: {
      chapters: [
        { timestamp: '0:00', title: 'Intro' },
        { timestamp: '0:35', title: 'Intelligence Brief' },
        { timestamp: '1:05', title: 'Build Status' },
        { timestamp: '2:00', title: 'Board Highlights' },
        { timestamp: '5:00', title: 'Moon Shot' },
        { timestamp: '6:20', title: "What's Next" },
      ],
    },
  },
};

// Video dimensions and frame rate — standard YouTube 1080p
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const VIDEO_FPS = 30;

// Total duration: 150 seconds at 30fps = 4500 frames
const TOTAL_FRAMES = VIDEO_FPS * 150;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="BoardroomVideo"
        component={BoardroomVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="OnboardingVideo"
        component={OnboardingVideo}
        durationInFrames={ONBOARDING_TOTAL_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={{}}
      />
    </>
  );
};
