/**
 * AnimatedCounter — Animated number counter component (UNI-1666)
 */

import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CCW_COLORS, CCW_FONTS } from './CCWBranding';

interface AnimatedCounterProps {
  from: number;
  to: number;
  unit: string;
  label: string;
  direction: 'up' | 'down';
  accentColor?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  from,
  to,
  unit,
  label,
  direction,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const currentValue = interpolate(frame, [0, durationInFrames - 1], [from, to], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const displayValue = Math.round(currentValue);

  const resolvedColor =
    accentColor ??
    (direction === 'down' ? CCW_COLORS.green : CCW_COLORS.bluePrimary);

  const arrow = direction === 'down' ? '↓' : '↑';

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: CCW_FONTS.heading,
        opacity: fadeIn,
      }}
    >
      {/* Arrow indicator */}
      <div
        style={{
          fontSize: 48,
          color: resolvedColor,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {arrow}
      </div>

      {/* Main number + unit */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: resolvedColor,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayValue}
        </span>
        <span
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: resolvedColor,
            lineHeight: 1,
          }}
        >
          {unit}
        </span>
      </div>

      {/* Label */}
      <div
        style={{
          marginTop: 16,
          fontSize: 24,
          fontWeight: 500,
          color: CCW_COLORS.textMuted,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
};
