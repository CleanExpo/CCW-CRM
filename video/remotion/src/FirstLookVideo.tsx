import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { HeroScene } from './scenes/firstlook/HeroScene';
import { ProblemScene } from './scenes/firstlook/ProblemScene';
import { ModuleShowcaseScene } from './scenes/firstlook/ModuleShowcaseScene';
import { WorkflowScene } from './scenes/firstlook/WorkflowScene';
import { WhoItsForScene } from './scenes/firstlook/WhoItsForScene';
import { GetStartedScene } from './scenes/firstlook/GetStartedScene';

// 180 seconds @ 30fps = 5400 frames
export const FIRST_LOOK_TOTAL_FRAMES = 5400;

export interface FirstLookVideoProps {
  narrationPath?: string;
}

export const FirstLookVideo: React.FC<FirstLookVideoProps> = ({ narrationPath }) => {
  return (
    <AbsoluteFill>
      {/* Background narration audio */}
      {narrationPath && <Audio src={staticFile(narrationPath)} />}

      <Sequence from={0} durationInFrames={900}>
        <HeroScene />
      </Sequence>
      <Sequence from={900} durationInFrames={900}>
        <ProblemScene />
      </Sequence>
      <Sequence from={1800} durationInFrames={1350}>
        <ModuleShowcaseScene />
      </Sequence>
      <Sequence from={3150} durationInFrames={900}>
        <WorkflowScene />
      </Sequence>
      <Sequence from={4050} durationInFrames={600}>
        <WhoItsForScene />
      </Sequence>
      <Sequence from={4650} durationInFrames={750}>
        <GetStartedScene />
      </Sequence>
    </AbsoluteFill>
  );
};
