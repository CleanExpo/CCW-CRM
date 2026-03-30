/**
 * CCW Branding — Shared brand tokens and components (UNI-1666)
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Color Palette
// ---------------------------------------------------------------------------

export const CCW_COLORS = {
  darkBg: '#0f172a',
  mediumBg: '#1e293b',
  bluePrimary: '#3b82f6',
  blueLight: '#60a5fa',
  green: '#22c55e',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  textPrimary: '#f8fafc',
  textMuted: '#94a3b8',
} as const;

// ---------------------------------------------------------------------------
// Font Stack
// ---------------------------------------------------------------------------

export const CCW_FONTS = {
  heading: 'system-ui, sans-serif',
  mono: 'monospace',
} as const;

// ---------------------------------------------------------------------------
// CCWLogo Component
// ---------------------------------------------------------------------------

interface CCWLogoProps {
  size?: 'sm' | 'md' | 'lg';
  accentColor?: string;
}

const SIZE_MAP = {
  sm: { main: 60, sub: 14, gap: 6 },
  md: { main: 80, sub: 18, gap: 8 },
  lg: { main: 120, sub: 24, gap: 12 },
};

export const CCWLogo: React.FC<CCWLogoProps> = ({
  size = 'md',
  accentColor = CCW_COLORS.bluePrimary,
}) => {
  const { main, sub, gap } = SIZE_MAP[size];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: CCW_FONTS.heading,
      }}
    >
      <div
        style={{
          fontSize: main,
          fontWeight: 900,
          color: CCW_COLORS.textPrimary,
          letterSpacing: -2,
          lineHeight: 1,
        }}
      >
        <span style={{ color: accentColor }}>CCW</span>
      </div>
      <div
        style={{
          marginTop: gap,
          fontSize: sub,
          fontWeight: 600,
          color: CCW_COLORS.textMuted,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        Carpet Cleaners Warehouse
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AccentBar Component
// ---------------------------------------------------------------------------

interface AccentBarProps {
  width?: string | number;
}

export const AccentBar: React.FC<AccentBarProps> = ({ width = '100%' }) => {
  return (
    <div
      style={{
        width,
        height: 4,
        background: `linear-gradient(90deg, ${CCW_COLORS.bluePrimary}, ${CCW_COLORS.purple}, ${CCW_COLORS.cyan})`,
        flexShrink: 0,
      }}
    />
  );
};
