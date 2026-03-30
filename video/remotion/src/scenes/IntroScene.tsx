/**
 * Scene 1 — Intro (UNI-1666)
 * CCW logo + session title card. ~5 seconds.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface IntroSceneProps {
  title: string;
  sessionId: string;
  date: string;
}

export const IntroScene: React.FC<IntroSceneProps> = ({ title, sessionId, date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const slideY = interpolate(frame, [0, fps * 0.5], [40, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* CCW Logo / Brand */}
      <div
        style={{
          opacity,
          transform: `translateY(${slideY}px)`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: '#60a5fa',
            letterSpacing: 8,
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          CCW — Carpet Cleaners Warehouse
        </div>
        <h1
          style={{
            fontSize: 56,
            color: '#ffffff',
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 900,
            textAlign: 'center',
          }}
        >
          {title}
        </h1>
        <div
          style={{
            marginTop: 32,
            fontSize: 20,
            color: '#94a3b8',
          }}
        >
          AI Boardroom Session · {date}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            color: '#475569',
            fontFamily: 'monospace',
          }}
        >
          {sessionId}
        </div>
      </div>

      {/* Bottom accent bar */}
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
