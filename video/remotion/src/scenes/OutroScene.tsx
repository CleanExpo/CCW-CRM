/**
 * Scene 7 — Outro (UNI-1666)
 * Final brand card with session ID and logo lockup.
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface OutroSceneProps {
  sessionId: string;
}

export const OutroScene: React.FC<OutroSceneProps> = ({ sessionId }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [fps * 3, fps * 4], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        opacity: fadeOut,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 18,
            color: '#60a5fa',
            letterSpacing: 6,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          CCW — Carpet Cleaners Warehouse
        </div>
        <div
          style={{
            fontSize: 14,
            color: '#334155',
            fontFamily: 'monospace',
          }}
        >
          Session: {sessionId}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 12,
            color: '#1e293b',
          }}
        >
          Produced autonomously by CCW Boardroom AI System
        </div>
      </div>
    </AbsoluteFill>
  );
};
