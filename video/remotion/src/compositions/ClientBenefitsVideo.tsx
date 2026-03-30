/**
 * ClientBenefitsVideo — 120-second client benefits composition (UNI-1666)
 *
 * Scenes:
 *   Intro          0–179    (6s)
 *   PainPoint      180–629  (15s)
 *   SolutionReveal 630–929  (10s)
 *   MetricCounter1 930–1379 (15s)
 *   MetricCounter2 1380–1829 (15s)
 *   MetricCounter3 1830–2279 (15s)
 *   Testimonial    2280–2699 (14s)
 *   CTA            2700–3599 (30s)
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
import type { ClientBenefitsVideoProps } from '../types';
import { CCW_COLORS, CCW_FONTS, CCWLogo, AccentBar } from '../components/CCWBranding';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { SpeakerCard } from '../components/SpeakerCard';
import { BenefitPill } from '../components/BenefitPill';

// ---------------------------------------------------------------------------
// Industry badge label map
// ---------------------------------------------------------------------------

const INDUSTRY_LABELS: Record<string, string> = {
  trades: 'For Trades Businesses',
  restoration: 'For Restoration Companies',
  training: 'For Training Providers',
};

// ---------------------------------------------------------------------------
// Intro Scene
// ---------------------------------------------------------------------------

const IntroScene: React.FC<{
  industry: ClientBenefitsVideoProps['industry'];
}> = ({ industry }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, ${CCW_COLORS.mediumBg} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${slideY}px)`,
          textAlign: 'center',
        }}
      >
        <CCWLogo size="lg" />
        <div style={{ marginTop: 40 }}>
          {/* Industry pill badge */}
          <div
            style={{
              display: 'inline-block',
              background: CCW_COLORS.bluePrimary,
              borderRadius: 999,
              padding: '10px 28px',
              fontSize: 20,
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {INDUSTRY_LABELS[industry] || industry}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// PainPoint Scene
// ---------------------------------------------------------------------------

const PainPointScene: React.FC<{ painPoint: string }> = ({ painPoint }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #3b0f0f 0%, ${CCW_COLORS.darkBg} 100%)`,
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
            fontSize: 60,
            marginBottom: 24,
          }}
        >
          😫
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#f87171',
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          The Problem
        </div>
        <p
          style={{
            fontSize: 36,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.5,
            margin: 0,
            fontWeight: 600,
          }}
        >
          {painPoint}
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <div
          style={{
            height: 4,
            background: 'linear-gradient(90deg, #ef4444, transparent)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// SolutionReveal Scene
// ---------------------------------------------------------------------------

const SolutionRevealScene: React.FC<{ solutionName: string }> = ({ solutionName }) => {
  const frame = useCurrentFrame();

  // Background transitions from red tint → blue tint
  const redAmount = interpolate(frame, [0, 30], [180, 0], { extrapolateRight: 'clamp' });
  const bgColor = `rgb(${Math.round(redAmount * 0.15)}, ${Math.round(redAmount * 0.05)}, ${Math.round(30 + (1 - redAmount / 180) * 60)})`;

  const opacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(frame, [5, 25], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${bgColor} 0%, ${CCW_COLORS.darkBg} 100%)`,
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
          transform: `translateY(${slideY}px)`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: CCW_COLORS.textPrimary,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {solutionName}
        </h2>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// MetricCounterScene
// ---------------------------------------------------------------------------

const MetricCounterScene: React.FC<{
  label: string;
  value: number;
  unit: string;
  direction: 'up' | 'down';
}> = ({ label, value, unit, direction }) => {
  const frame = useCurrentFrame();
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: CCW_COLORS.darkBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: bgOpacity,
      }}
    >
      <AnimatedCounter
        from={0}
        to={value}
        unit={unit}
        label={label}
        direction={direction}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// MetricSummaryRow (used when no testimonial)
// ---------------------------------------------------------------------------

const MetricSummaryRow: React.FC<{
  metrics: ClientBenefitsVideoProps['metrics'];
}> = ({ metrics }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: CCW_COLORS.darkBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 80,
        opacity,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      {metrics.slice(0, 3).map((m, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: m.direction === 'down' ? CCW_COLORS.green : CCW_COLORS.bluePrimary,
            }}
          >
            {m.value}
            {m.unit}
          </div>
          <div style={{ fontSize: 20, color: CCW_COLORS.textMuted, marginTop: 8 }}>{m.label}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// CTA Scene
// ---------------------------------------------------------------------------

const CTAScene: React.FC<{
  ctaText: string;
  metrics: ClientBenefitsVideoProps['metrics'];
}> = ({ ctaText, metrics }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const pillTexts = ['Time Saved', 'Cost Reduced', 'Value Added'];
  const pillColors = [CCW_COLORS.green, CCW_COLORS.bluePrimary, CCW_COLORS.purple];

  // Keep metrics in scope to avoid unused param lint (referenced via metrics.length check)
  void metrics;

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
      <div style={{ opacity, textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: CCW_COLORS.textPrimary,
            margin: '0 0 40px 0',
          }}
        >
          {ctaText}
        </h2>

        {/* Benefit pills row */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            justifyContent: 'center',
            marginBottom: 60,
            flexWrap: 'wrap',
          }}
        >
          {pillTexts.map((text, i) => (
            <BenefitPill key={text} text={text} color={pillColors[i]} delay={i * 10} />
          ))}
        </div>

        <CCWLogo size="md" />
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

export const ClientBenefitsVideo: React.FC<ClientBenefitsVideoProps> = ({
  industry,
  painPoint,
  solutionName,
  metrics,
  testimonialQuote,
  testimonialSource,
  ctaText,
  narrationPath,
}) => {
  return (
    <AbsoluteFill>
      {narrationPath && <Audio src={staticFile(narrationPath)} />}

      {/* Intro: 0–179 (6s) */}
      <Sequence from={0} durationInFrames={180}>
        <IntroScene industry={industry} />
      </Sequence>

      {/* PainPoint: 180–629 (15s) */}
      <Sequence from={180} durationInFrames={450}>
        <PainPointScene painPoint={painPoint} />
      </Sequence>

      {/* SolutionReveal: 630–929 (10s) */}
      <Sequence from={630} durationInFrames={300}>
        <SolutionRevealScene solutionName={solutionName} />
      </Sequence>

      {/* MetricCounter 1: 930–1379 (15s) */}
      {metrics[0] && (
        <Sequence from={930} durationInFrames={450}>
          <MetricCounterScene
            label={metrics[0].label}
            value={metrics[0].value}
            unit={metrics[0].unit}
            direction={metrics[0].direction}
          />
        </Sequence>
      )}

      {/* MetricCounter 2: 1380–1829 (15s) */}
      {metrics[1] && (
        <Sequence from={1380} durationInFrames={450}>
          <MetricCounterScene
            label={metrics[1].label}
            value={metrics[1].value}
            unit={metrics[1].unit}
            direction={metrics[1].direction}
          />
        </Sequence>
      )}

      {/* MetricCounter 3: 1830–2279 (15s) */}
      {metrics[2] && (
        <Sequence from={1830} durationInFrames={450}>
          <MetricCounterScene
            label={metrics[2].label}
            value={metrics[2].value}
            unit={metrics[2].unit}
            direction={metrics[2].direction}
          />
        </Sequence>
      )}

      {/* Testimonial: 2280–2699 (14s) */}
      <Sequence from={2280} durationInFrames={420}>
        {testimonialQuote ? (
          <SpeakerCard
            name={testimonialSource || 'Client'}
            title=""
            insight={testimonialQuote}
            accentColor={CCW_COLORS.green}
            showLabel="What Our Clients Say"
          />
        ) : (
          <MetricSummaryRow metrics={metrics} />
        )}
      </Sequence>

      {/* CTA: 2700–3599 (30s) */}
      <Sequence from={2700} durationInFrames={900}>
        <CTAScene ctaText={ctaText} metrics={metrics} />
      </Sequence>
    </AbsoluteFill>
  );
};
