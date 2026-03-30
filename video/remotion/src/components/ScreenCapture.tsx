/**
 * ScreenCapture — Full-bleed screenshot display with optional caption and annotation ring (UNI-1666)
 */

import React from 'react';
import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CCW_COLORS } from './CCWBranding';

interface ScreenCaptureProps {
  screenshotPath: string;
  caption?: string;
  annotated?: boolean;
}

export const ScreenCapture: React.FC<ScreenCaptureProps> = ({
  screenshotPath,
  caption,
  annotated = false,
}) => {
  const frame = useCurrentFrame();

  // Fade in over first 15 frames
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Pulsing border opacity (0.6 → 1.0 → 0.6 cycle)
  const pulseOpacity = annotated
    ? interpolate(
        Math.sin((frame / 30) * Math.PI),
        [-1, 1],
        [0.5, 1.0],
        { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
      )
    : 1;

  const combinedOpacity = annotated ? pulseOpacity * opacity : opacity;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        opacity: combinedOpacity,
        boxSizing: 'border-box',
        border: annotated ? `3px solid ${CCW_COLORS.bluePrimary}` : 'none',
      }}
    >
      <Img
        src={staticFile(screenshotPath)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />

      {caption && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 50,
            background: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 500,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {caption}
          </span>
        </div>
      )}
    </div>
  );
};
