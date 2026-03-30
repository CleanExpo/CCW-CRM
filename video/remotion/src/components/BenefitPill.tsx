/**
 * BenefitPill — Animated pill badge component (UNI-1666)
 */

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CCW_COLORS, CCW_FONTS } from './CCWBranding';

interface BenefitPillProps {
  text: string;
  color?: string;
  delay?: number;
}

export const BenefitPill: React.FC<BenefitPillProps> = ({
  text,
  color = CCW_COLORS.bluePrimary,
  delay = 0,
}) => {
  const frame = useCurrentFrame();

  // Animate from frame `delay` to `delay + 20`
  const animStart = delay;
  const animEnd = delay + 20;

  const translateX = interpolate(frame, [animStart, animEnd], [-100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [animStart, animEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'inline-block',
        borderRadius: 999,
        padding: '8px 20px',
        backgroundColor: color,
        transform: `translateX(${translateX}px)`,
        opacity,
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <span
        style={{
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 16,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
};
