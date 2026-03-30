/**
 * FeatureSpotlightVideo — 75-second feature spotlight composition (UNI-1666)
 *
 * Scenes:
 *   1. Hook       (0–149,   5s)
 *   2. FeatureDemo (150–1499, 45s)
 *   3. KeyBenefit  (1500–1949, 15s)
 *   4. CTA         (1950–2249, 10s)
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
import type { FeatureSpotlightVideoProps } from '../types';
import { CCW_COLORS, CCW_FONTS, CCWLogo, AccentBar } from '../components/CCWBranding';
import { ScreenCapture } from '../components/ScreenCapture';
import { BenefitPill } from '../components/BenefitPill';

// ---------------------------------------------------------------------------
// Hook Scene
// ---------------------------------------------------------------------------

const HookScene: React.FC<{ hookStatement: string; isPortrait: boolean }> = ({
  hookStatement,
  isPortrait,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const baseFontSize = isPortrait ? 86 : 72;

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
      {/* Logo top */}
      <div style={{ position: 'absolute', top: isPortrait ? 60 : 40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <CCWLogo size="sm" />
      </div>

      {/* Hook statement */}
      <div style={{ opacity, textAlign: 'center', maxWidth: 1200 }}>
        <h1
          style={{
            fontSize: baseFontSize,
            fontWeight: 900,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          {hookStatement}
        </h1>
      </div>

      {/* Bottom accent */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Feature Demo Scene
// ---------------------------------------------------------------------------

const FeatureDemoScene: React.FC<{
  featureName: string;
  screenshot?: string;
  screenshotCaption?: string;
  isPortrait: boolean;
}> = ({ featureName, screenshot, screenshotCaption, isPortrait }) => {
  const frame = useCurrentFrame();

  // Animated underline reveal (used when no screenshot)
  const underlineWidth = interpolate(frame, [10, 50], [0, 100], { extrapolateRight: 'clamp' });
  const textOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const baseFontSize = isPortrait ? 96 : 80;

  if (screenshot) {
    return (
      <AbsoluteFill>
        <ScreenCapture
          screenshotPath={screenshot}
          caption={screenshotCaption}
          annotated
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        background: CCW_COLORS.darkBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: CCW_FONTS.heading,
        padding: isPortrait ? 60 : 80,
      }}
    >
      <div style={{ opacity: textOpacity, textAlign: 'center' }}>
        <div
          style={{
            fontSize: baseFontSize,
            fontWeight: 900,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.1,
          }}
        >
          {featureName}
        </div>
        {/* Animated underline reveal */}
        <div
          style={{
            marginTop: 12,
            height: 6,
            background: `linear-gradient(90deg, ${CCW_COLORS.bluePrimary}, ${CCW_COLORS.cyan})`,
            width: `${underlineWidth}%`,
            borderRadius: 3,
            transition: 'width 0.1s',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Key Benefit Scene
// ---------------------------------------------------------------------------

const KeyBenefitScene: React.FC<{ keyBenefit: string; isPortrait: boolean }> = ({
  keyBenefit,
  isPortrait,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const slideY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });
  const baseFontSize = isPortrait ? 52 : 44;
  const padding = isPortrait ? 60 : 80;

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
      <div
        style={{
          opacity,
          transform: `translateY(${slideY}px)`,
          textAlign: 'center',
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: CCW_COLORS.green,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          Key Benefit
        </div>
        <h2
          style={{
            fontSize: baseFontSize,
            fontWeight: 800,
            color: CCW_COLORS.textPrimary,
            lineHeight: 1.25,
            margin: '0 0 40px 0',
          }}
        >
          {keyBenefit}
        </h2>

        {/* Animated benefit pills */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <BenefitPill text="Save Time" color={CCW_COLORS.green} delay={15} />
          <BenefitPill text="Reduce Errors" color={CCW_COLORS.bluePrimary} delay={25} />
          <BenefitPill text="Grow Revenue" color={CCW_COLORS.purple} delay={35} />
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

const CTAScene: React.FC<{ ctaText: string; isPortrait: boolean }> = ({
  ctaText,
  isPortrait,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const baseFontSize = isPortrait ? 62 : 52;
  const padding = isPortrait ? 60 : 80;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CCW_COLORS.darkBg} 0%, #1e1b4b 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <CCWLogo size="md" accentColor={CCW_COLORS.bluePrimary} />
        <div style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: baseFontSize,
              fontWeight: 900,
              color: CCW_COLORS.textPrimary,
              margin: '0 0 16px 0',
            }}
          >
            {ctaText}
          </h2>
          <div
            style={{
              fontSize: isPortrait ? 26 : 22,
              color: CCW_COLORS.textMuted,
              fontWeight: 500,
            }}
          >
            Visit ccw.com.au
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
// Main Composition
// ---------------------------------------------------------------------------

export const FeatureSpotlightVideo: React.FC<FeatureSpotlightVideoProps> = ({
  featureName,
  hookStatement,
  screenshot,
  screenshotCaption,
  keyBenefit,
  ctaText,
  narrationPath,
}) => {
  const { width, height } = useVideoConfig();
  const isPortrait = width < height;

  // Scene frame boundaries
  const HOOK_START = 0;
  const HOOK_DUR = 150;
  const DEMO_START = 150;
  const DEMO_DUR = 1350;
  const BENEFIT_START = 1500;
  const BENEFIT_DUR = 450;
  const CTA_START = 1950;
  const CTA_DUR = 300;

  return (
    <AbsoluteFill>
      {narrationPath && <Audio src={staticFile(narrationPath)} />}

      <Sequence from={HOOK_START} durationInFrames={HOOK_DUR}>
        <HookScene hookStatement={hookStatement} isPortrait={isPortrait} />
      </Sequence>

      <Sequence from={DEMO_START} durationInFrames={DEMO_DUR}>
        <FeatureDemoScene
          featureName={featureName}
          screenshot={screenshot}
          screenshotCaption={screenshotCaption}
          isPortrait={isPortrait}
        />
      </Sequence>

      <Sequence from={BENEFIT_START} durationInFrames={BENEFIT_DUR}>
        <KeyBenefitScene keyBenefit={keyBenefit} isPortrait={isPortrait} />
      </Sequence>

      <Sequence from={CTA_START} durationInFrames={CTA_DUR}>
        <CTAScene ctaText={ctaText} isPortrait={isPortrait} />
      </Sequence>
    </AbsoluteFill>
  );
};
