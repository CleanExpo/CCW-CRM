/**
 * SpeakerCard — Generalised speaker/quote card component (UNI-1666)
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CCW_COLORS, CCW_FONTS, AccentBar } from './CCWBranding';

interface SpeakerCardProps {
  name: string;
  title: string;
  insight: string;
  accentColor: string;
  showLabel?: string;
}

export const SpeakerCard: React.FC<SpeakerCardProps> = ({
  name,
  title,
  insight,
  accentColor,
  showLabel,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Header fades in during first 30% of duration
  const headerFadeEnd = durationInFrames * 0.3;
  const headerOpacity = interpolate(frame, [0, headerFadeEnd], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Content fades + slides in from 30% to 70% of duration
  const contentFadeStart = durationInFrames * 0.3;
  const contentFadeEnd = durationInFrames * 0.7;
  const contentOpacity = interpolate(frame, [contentFadeStart, contentFadeEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentSlide = interpolate(frame, [contentFadeStart, contentFadeEnd], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <AbsoluteFill
      style={{
        background: CCW_COLORS.darkBg,
        display: 'flex',
        flexDirection: 'column',
        padding: '80px 120px',
        fontFamily: CCW_FONTS.heading,
      }}
    >
      {/* Optional label */}
      {showLabel && (
        <div
          style={{
            opacity: headerOpacity,
            fontSize: 14,
            fontWeight: 600,
            color: CCW_COLORS.textMuted,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          {showLabel}
        </div>
      )}

      {/* Avatar + name block */}
      <div
        style={{
          opacity: headerOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 48,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 12,
            background: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: CCW_COLORS.textPrimary,
            }}
          >
            {name}
          </div>
          {title && (
            <div
              style={{
                fontSize: 16,
                color: CCW_COLORS.textMuted,
                marginTop: 4,
              }}
            >
              {title}
            </div>
          )}
        </div>
      </div>

      {/* Insight quote */}
      <div
        style={{
          opacity: contentOpacity,
          transform: `translateY(${contentSlide}px)`,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            borderLeft: `4px solid ${accentColor}`,
            paddingLeft: 32,
          }}
        >
          <p
            style={{
              fontSize: 24,
              color: '#e2e8f0',
              lineHeight: 1.6,
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            &ldquo;{insight}&rdquo;
          </p>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <AccentBar />
      </div>
    </AbsoluteFill>
  );
};
