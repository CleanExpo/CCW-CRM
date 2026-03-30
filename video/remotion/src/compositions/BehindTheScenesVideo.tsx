/**
 * BehindTheScenesVideo — Dynamic boardroom narrative composition (UNI-1666)
 *
 * Scenes (offset-accumulation pattern):
 *   1. OpeningQuestion  (15s)
 *   2. BoardMember ×n   (20s each)
 *   3. ConflictMoment   (12s, optional)
 *   4. DecisionReveal   (15s)
 *   5. Outcome          (10s)
 *   6. Impact           (8s)
 *   7. CTA              (10s)
 */

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import type { BehindTheScenesVideoProps } from '../types';
import { CCW_COLORS, CCW_FONTS, CCWLogo, AccentBar } from '../components/CCWBranding';
import { SpeakerCard } from '../components/SpeakerCard';

// ---------------------------------------------------------------------------
// OpeningQuestion Scene
// ---------------------------------------------------------------------------

const OpeningQuestionScene: React.FC<{
  sessionDate: string;
  openingQuestion: string;
}> = ({ sessionDate, openingQuestion }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(frame, [0, 25], [40, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, #1e3a5f 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      {/* Session date */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 600,
          color: CCW_COLORS.textMuted,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        {sessionDate}
      </div>

      <div style={{ opacity, transform: `translateY(${slideY}px)`, textAlign: 'center', maxWidth: 1200 }}>
        <div
          style={{
            fontSize: 18,
            color: CCW_COLORS.blueLight,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          Today&apos;s Question
        </div>
        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.2,
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          &ldquo;{openingQuestion}&rdquo;
        </h1>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// ConflictMoment Scene
// ---------------------------------------------------------------------------

const ConflictMomentScene: React.FC<{ conflictMoment: string }> = ({ conflictMoment }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #451a03 0%, ${CCW_COLORS.darkBg} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center', maxWidth: 1100 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: CCW_COLORS.amber,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          ⚠️ A Point of Tension
        </div>
        <p
          style={{
            fontSize: 40,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.5,
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          &ldquo;{conflictMoment}&rdquo;
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${CCW_COLORS.amber}, transparent)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// DecisionReveal Scene
// ---------------------------------------------------------------------------

const DecisionRevealScene: React.FC<{ decision: string }> = ({ decision }) => {
  const frame = useCurrentFrame();
  const slideX = interpolate(frame, [0, 30], [-80, 0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, #1e1b4b 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateX(${slideX}px)`,
          textAlign: 'center',
          maxWidth: 1200,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: CCW_COLORS.bluePrimary,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          The Decision Was Made
        </div>
        <h2
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {decision}
        </h2>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${CCW_COLORS.bluePrimary}, transparent)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Outcome Scene
// ---------------------------------------------------------------------------

const OutcomeScene: React.FC<{ outcome: string }> = ({ outcome }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #052e16 0%, ${CCW_COLORS.darkBg} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center', maxWidth: 1100 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: CCW_COLORS.green,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          What Happened Next
        </div>
        <p
          style={{
            fontSize: 44,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.4,
            margin: 0,
            fontWeight: 700,
          }}
        >
          {outcome}
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${CCW_COLORS.green}, transparent)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Impact Scene
// ---------------------------------------------------------------------------

const ImpactScene: React.FC<{ impact: string; moonShot: string }> = ({ impact, moonShot }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: CCW_COLORS.darkBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center', maxWidth: 1200 }}>
        <p
          style={{
            fontSize: 42,
            color: CCW_COLORS.textPrimary,
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: 40,
          }}
        >
          {impact}
        </p>
        <p
          style={{
            fontSize: 24,
            color: CCW_COLORS.purple,
            fontStyle: 'italic',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          🚀 {moonShot}
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// CTA Scene
// ---------------------------------------------------------------------------

const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, #1e3a5f 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <CCWLogo size="lg" />
        <div
          style={{
            marginTop: 40,
            fontSize: 28,
            color: CCW_COLORS.textMuted,
            fontWeight: 500,
          }}
        >
          Subscribe · Be Here For The Next Session
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main Composition
// ---------------------------------------------------------------------------

export const BehindTheScenesVideo: React.FC<BehindTheScenesVideoProps> = ({
  sessionDate,
  openingQuestion,
  boardMemberHighlights,
  conflictMoment,
  decision,
  moonShot,
  outcome,
  impact,
  narrationPath,
}) => {
  const fps = 30;
  const memberCount = boardMemberHighlights.length;
  const hasConflict = !!conflictMoment;

  // Scene durations in frames
  const OPENING_DUR = fps * 15;
  const MEMBER_DUR = fps * 20;
  const CONFLICT_DUR = fps * 12;
  const DECISION_DUR = fps * 15;
  const OUTCOME_DUR = fps * 10;
  const IMPACT_DUR = fps * 8;
  const CTA_DUR = fps * 10;

  // Offset accumulation
  let offset = 0;

  const openingStart = offset;
  offset += OPENING_DUR;

  const memberStarts = boardMemberHighlights.map(() => {
    const s = offset;
    offset += MEMBER_DUR;
    return s;
  });

  const conflictStart = offset;
  if (hasConflict) offset += CONFLICT_DUR;

  const decisionStart = offset;
  offset += DECISION_DUR;

  const outcomeStart = offset;
  offset += OUTCOME_DUR;

  const impactStart = offset;
  offset += IMPACT_DUR;

  const ctaStart = offset;

  return (
    <AbsoluteFill>
      {narrationPath && <Audio src={staticFile(narrationPath)} />}

      {/* Scene 1: Opening Question */}
      <Sequence from={openingStart} durationInFrames={OPENING_DUR}>
        <OpeningQuestionScene sessionDate={sessionDate} openingQuestion={openingQuestion} />
      </Sequence>

      {/* Scene 2: Board Member Highlights */}
      {boardMemberHighlights.map((member, i) => (
        <Sequence key={`member-${i}`} from={memberStarts[i]} durationInFrames={MEMBER_DUR}>
          <SpeakerCard
            name={member.name}
            title={member.title}
            insight={member.insight}
            accentColor={member.accentColor}
          />
        </Sequence>
      ))}

      {/* Scene 3: Conflict Moment (optional) */}
      {hasConflict && conflictMoment && (
        <Sequence from={conflictStart} durationInFrames={CONFLICT_DUR}>
          <ConflictMomentScene conflictMoment={conflictMoment} />
        </Sequence>
      )}

      {/* Scene 4: Decision Reveal */}
      <Sequence from={decisionStart} durationInFrames={DECISION_DUR}>
        <DecisionRevealScene decision={decision} />
      </Sequence>

      {/* Scene 5: Outcome */}
      <Sequence from={outcomeStart} durationInFrames={OUTCOME_DUR}>
        <OutcomeScene outcome={outcome} />
      </Sequence>

      {/* Scene 6: Impact */}
      <Sequence from={impactStart} durationInFrames={IMPACT_DUR}>
        <ImpactScene impact={impact} moonShot={moonShot} />
      </Sequence>

      {/* Scene 7: CTA */}
      <Sequence from={ctaStart} durationInFrames={CTA_DUR}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
