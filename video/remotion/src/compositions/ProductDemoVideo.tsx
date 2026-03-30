/**
 * ProductDemoVideo — Dynamic product demo composition (UNI-1666)
 *
 * Duration based on screenshot count (max 8):
 *   fps * (5 + 10 + 8 + screenshotCount * 10 + 12 + 8)
 *
 * Scenes:
 *   Intro         (5s)
 *   ProblemSetup  (10s)
 *   FeatureIntro  (8s)
 *   ScreenDemo ×n (10s each)
 *   Results       (12s)
 *   CTA           (8s)
 */

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { ProductDemoVideoProps } from '../types';
import { CCW_COLORS, CCW_FONTS, CCWLogo, AccentBar } from '../components/CCWBranding';
import { ScreenCapture } from '../components/ScreenCapture';
import { BenefitPill } from '../components/BenefitPill';

// ---------------------------------------------------------------------------
// Intro Scene
// ---------------------------------------------------------------------------

const IntroScene: React.FC<{
  featureName: string;
  tagline: string;
  isPortrait: boolean;
}> = ({ featureName, tagline, isPortrait }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });
  const fontSize = isPortrait ? 80 : 68;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, #1e3a5f 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isPortrait ? 60 : 80,
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
        <CCWLogo size="md" />
        <h1
          style={{
            marginTop: 40,
            fontSize,
            fontWeight: 900,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.1,
          }}
        >
          {featureName}
        </h1>
        <p
          style={{
            marginTop: 20,
            fontSize: isPortrait ? 30 : 26,
            color: CCW_COLORS.textMuted,
            fontWeight: 500,
          }}
        >
          {tagline}
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// ProblemSetup Scene
// ---------------------------------------------------------------------------

const ProblemSetupScene: React.FC<{
  problemStatement: string;
  isPortrait: boolean;
}> = ({ problemStatement, isPortrait }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const fontSize = isPortrait ? 40 : 34;
  const padding = isPortrait ? 60 : 80;

  return (
    <AbsoluteFill
      style={{
        background: CCW_COLORS.darkBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div
        style={{
          opacity,
          borderLeft: `4px solid #ef4444`,
          paddingLeft: 40,
          maxWidth: 1100,
        }}
      >
        <p
          style={{
            fontSize,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.5,
            margin: 0,
            fontWeight: 600,
          }}
        >
          {problemStatement}
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
// FeatureIntro Scene
// ---------------------------------------------------------------------------

const FeatureIntroScene: React.FC<{
  featureName: string;
  isPortrait: boolean;
}> = ({ featureName, isPortrait }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const underlineWidth = interpolate(frame, [10, 40], [0, 100], { extrapolateRight: 'clamp' });
  const fontSize = isPortrait ? 90 : 76;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, ${CCW_COLORS.mediumBg} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isPortrait ? 60 : 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <h2
          style={{
            fontSize,
            fontWeight: 900,
            color: CCW_COLORS.textPrimary,
            margin: '0 0 16px 0',
          }}
        >
          {featureName}
        </h2>
        {/* Animated underline */}
        <div
          style={{
            height: 6,
            background: `linear-gradient(90deg, ${CCW_COLORS.bluePrimary}, ${CCW_COLORS.cyan})`,
            width: `${underlineWidth}%`,
            borderRadius: 3,
            margin: '0 auto 32px',
          }}
        />
        <p
          style={{
            fontSize: isPortrait ? 28 : 24,
            color: CCW_COLORS.textMuted,
            margin: 0,
          }}
        >
          Here&apos;s how it works
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// ScreenDemo Scene (single screenshot with slide-in)
// ---------------------------------------------------------------------------

const ScreenDemoScene: React.FC<{
  screenshotPath: string;
  caption?: string;
}> = ({ screenshotPath, caption }) => {
  const frame = useCurrentFrame();
  const slideX = interpolate(frame, [0, 20], [100, 0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${slideX}px)`,
        opacity,
      }}
    >
      <ScreenCapture screenshotPath={screenshotPath} caption={caption} annotated />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Results Scene
// ---------------------------------------------------------------------------

const ResultsScene: React.FC<{
  results: string;
  pillTexts: string[];
  isPortrait: boolean;
}> = ({ results, pillTexts, isPortrait }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const fontSize = isPortrait ? 48 : 40;
  const padding = isPortrait ? 60 : 80;

  const pillColors = [
    CCW_COLORS.green,
    CCW_COLORS.bluePrimary,
    CCW_COLORS.purple,
    CCW_COLORS.cyan,
  ];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #052e16 0%, ${CCW_COLORS.darkBg} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center', maxWidth: 1200 }}>
        <p
          style={{
            fontSize,
            fontWeight: 800,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.4,
            margin: '0 0 48px 0',
          }}
        >
          {results}
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {pillTexts.map((text, i) => (
            <BenefitPill
              key={text}
              text={text}
              color={pillColors[i % pillColors.length]}
              delay={i * 8}
            />
          ))}
        </div>
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

const CTAScene: React.FC<{
  ctaText: string;
  isPortrait: boolean;
}> = ({ ctaText, isPortrait }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const fontSize = isPortrait ? 58 : 48;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, #1e1b4b 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isPortrait ? 60 : 80,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <h2
          style={{
            fontSize,
            fontWeight: 900,
            color: CCW_COLORS.textPrimary,
            margin: '0 0 40px 0',
          }}
        >
          {ctaText}
        </h2>
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

export const ProductDemoVideo: React.FC<ProductDemoVideoProps> = ({
  featureName,
  tagline,
  problemStatement,
  screenshots,
  screenshotCaptions,
  results,
  ctaText,
  narrationPath,
}) => {
  const { width, height } = useVideoConfig();
  const isPortrait = width < height;

  const fps = 30;
  const screenshotCount = Math.min(screenshots.length, 8);

  // Scene durations in frames
  const INTRO_DUR = fps * 5;
  const PROBLEM_DUR = fps * 10;
  const FEATURE_DUR = fps * 8;
  const SCREEN_DUR = fps * 10;
  const RESULTS_DUR = fps * 12;
  const CTA_DUR = fps * 8;

  // Offset accumulation
  let offset = 0;
  const introStart = offset; offset += INTRO_DUR;
  const problemStart = offset; offset += PROBLEM_DUR;
  const featureStart = offset; offset += FEATURE_DUR;

  const screenStarts: number[] = [];
  for (let i = 0; i < screenshotCount; i++) {
    screenStarts.push(offset);
    offset += SCREEN_DUR;
  }

  const resultsStart = offset; offset += RESULTS_DUR;
  const ctaStart = offset;

  // Pill texts from screenshot captions (max 4)
  const pillTexts = screenshotCaptions.slice(0, 4).filter(Boolean);

  return (
    <AbsoluteFill>
      {narrationPath && <Audio src={staticFile(narrationPath)} />}

      <Sequence from={introStart} durationInFrames={INTRO_DUR}>
        <IntroScene featureName={featureName} tagline={tagline} isPortrait={isPortrait} />
      </Sequence>

      <Sequence from={problemStart} durationInFrames={PROBLEM_DUR}>
        <ProblemSetupScene problemStatement={problemStatement} isPortrait={isPortrait} />
      </Sequence>

      <Sequence from={featureStart} durationInFrames={FEATURE_DUR}>
        <FeatureIntroScene featureName={featureName} isPortrait={isPortrait} />
      </Sequence>

      {screenStarts.map((start, i) => (
        <Sequence key={`screen-${i}`} from={start} durationInFrames={SCREEN_DUR}>
          <ScreenDemoScene
            screenshotPath={screenshots[i]}
            caption={screenshotCaptions[i]}
          />
        </Sequence>
      ))}

      <Sequence from={resultsStart} durationInFrames={RESULTS_DUR}>
        <ResultsScene results={results} pillTexts={pillTexts} isPortrait={isPortrait} />
      </Sequence>

      <Sequence from={ctaStart} durationInFrames={CTA_DUR}>
        <CTAScene ctaText={ctaText} isPortrait={isPortrait} />
      </Sequence>
    </AbsoluteFill>
  );
};
