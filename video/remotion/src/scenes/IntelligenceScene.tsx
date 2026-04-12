/**
 * Scene 2 — Intelligence Brief (UNI-1666)
 * Displays the 3 key findings from the Data Sovereign.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface IntelligenceSceneProps {
  findings: string[];
}

export const IntelligenceScene: React.FC<IntelligenceSceneProps> = ({ findings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        padding: '80px 120px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: '#60a5fa',
          letterSpacing: 4,
          textTransform: 'uppercase',
          fontWeight: 600,
          marginBottom: 24,
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Intelligence Brief — This Week
      </div>

      {findings.slice(0, 3).map((finding, i) => {
        const startFrame = fps * 0.3 + i * fps * 0.4;
        const opacity = interpolate(frame, [startFrame, startFrame + fps * 0.3], [0, 1], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        });
        const slideX = interpolate(frame, [startFrame, startFrame + fps * 0.3], [-30, 0], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateX(${slideX}px)`,
              marginBottom: 40,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 24,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: ['#3b82f6', '#8b5cf6', '#06b6d4'][i],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
                marginTop: 4,
              }}
            >
              {i + 1}
            </div>
            <p
              style={{
                fontSize: 26,
                color: '#e2e8f0',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {finding}
            </p>
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
        }}
      />
    </AbsoluteFill>
  );
};
