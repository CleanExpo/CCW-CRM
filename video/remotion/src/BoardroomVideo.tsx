/**
 * CCW Boardroom — Main Video Composition (UNI-1666)
 *
 * 8-minute YouTube video assembled from 7 scene types:
 *   1. Intro (5s)
 *   2. Intelligence Brief (30s)
 *   3. Build Status (10s)
 *   4. Board Highlights × 4 (15s each = 60s)
 *   5. Moon Shot (20s)
 *   6. CTA (20s)
 *   7. Outro (5s)
 *
 * Total: ~150s base + narration audio drives actual duration
 */

import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { BoardroomVideoProps } from './types';
import { IntroScene } from './scenes/IntroScene';
import { IntelligenceScene } from './scenes/IntelligenceScene';
import { BuildStatusScene } from './scenes/BuildStatusScene';
import { BoardMemberScene } from './scenes/BoardMemberScene';
import { MoonShotScene } from './scenes/MoonShotScene';
import { CTAScene } from './scenes/CTAScene';
import { OutroScene } from './scenes/OutroScene';

const BOARD_ACCENT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];
const BOARD_MEMBER_HIGHLIGHTS = [
  { name: 'The Architect', title: 'Systems Design', key: 'architect' },
  { name: 'The Revenue Guardian', title: 'Revenue Strategy', key: 'revenue_guardian' },
  { name: 'The Agent Whisperer', title: 'AI Architecture', key: 'agent_whisperer' },
  { name: 'The Integration Maestro', title: 'Integration Design', key: 'integration_maestro' },
];

export const BoardroomVideo: React.FC<BoardroomVideoProps> = ({
  sessionId,
  videoBrief,
  narrationPath,
}) => {
  const { fps } = useVideoConfig();

  // Scene durations in frames
  const INTRO = fps * 5;
  const INTELLIGENCE = fps * 30;
  const BUILD_STATUS = fps * 10;
  const BOARD_MEMBER = fps * 15;
  const MOON_SHOT = fps * 20;
  const CTA = fps * 20;
  const OUTRO = fps * 5;

  const sessionDate = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Extract build status and reason from session data
  const buildStatus = (videoBrief as any).buildStatus || 'AMBER';
  const buildReason = (videoBrief as any).buildReason || 'System under active development.';

  // Extract findings from intelligence (split by newline, take first 3 non-empty)
  const intelligenceRaw = (videoBrief as any).intelligence || '';
  const findings = intelligenceRaw
    .split('\n')
    .filter((line: string) => line.trim().length > 20)
    .slice(0, 3);

  const moonShot = (videoBrief as any).moonShot || 'The next frontier for CCW is full AI autonomy.';

  // Calculate sequence starts
  let cursor = 0;
  const introStart = cursor;
  cursor += INTRO;
  const intelligenceStart = cursor;
  cursor += INTELLIGENCE;
  const buildStart = cursor;
  cursor += BUILD_STATUS;
  const boardStarts = BOARD_MEMBER_HIGHLIGHTS.map(() => {
    const s = cursor;
    cursor += BOARD_MEMBER;
    return s;
  });
  const moonStart = cursor;
  cursor += MOON_SHOT;
  const ctaStart = cursor;
  cursor += CTA;
  const outroStart = cursor;

  return (
    <AbsoluteFill>
      {/* Background narration audio */}
      {narrationPath && <Audio src={narrationPath} />}

      <Sequence from={introStart} durationInFrames={INTRO}>
        <IntroScene title={videoBrief.title} sessionId={sessionId} date={sessionDate} />
      </Sequence>

      <Sequence from={intelligenceStart} durationInFrames={INTELLIGENCE}>
        <IntelligenceScene
          findings={findings.length > 0 ? findings : ['Intelligence gathering in progress...']}
        />
      </Sequence>

      <Sequence from={buildStart} durationInFrames={BUILD_STATUS}>
        <BuildStatusScene status={buildStatus as 'GREEN' | 'AMBER' | 'RED'} reason={buildReason} />
      </Sequence>

      {BOARD_MEMBER_HIGHLIGHTS.map((member, i) => {
        const insight =
          (videoBrief as any).boardOutputs?.[member.key]
            ?.split('\n')
            .find((line: string) => line.length > 30 && !line.startsWith('#')) ||
          'Key insight from this session.';

        return (
          <Sequence key={member.key} from={boardStarts[i]} durationInFrames={BOARD_MEMBER}>
            <BoardMemberScene
              memberName={member.name}
              memberTitle={member.title}
              insight={insight.slice(0, 200)}
              accentColor={BOARD_ACCENT_COLORS[i % BOARD_ACCENT_COLORS.length]}
            />
          </Sequence>
        );
      })}

      <Sequence from={moonStart} durationInFrames={MOON_SHOT}>
        <MoonShotScene moonShot={moonShot} />
      </Sequence>

      <Sequence from={ctaStart} durationInFrames={CTA}>
        <CTAScene />
      </Sequence>

      <Sequence from={outroStart} durationInFrames={OUTRO}>
        <OutroScene sessionId={sessionId} />
      </Sequence>
    </AbsoluteFill>
  );
};
